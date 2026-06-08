from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.user import User, UserRole
from app.schemas.auth import (
    AuthMeResponse,
    CompanyProfile,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserProfile,
)
from app.services.auth import create_access_token, hash_password, verify_password
from app.services.companies import find_existing_company, get_owner_emails, is_valid_slug, normalize_slug

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    email = str(payload.email).lower()
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id), str(user.company_id), user.role.value)
    return TokenResponse(access_token=token)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_company(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    slug = normalize_slug(payload.company_slug)
    if not is_valid_slug(slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Company URL must use lowercase letters, numbers, and hyphens only",
        )

    admin_email = str(payload.admin_email).lower()
    existing_user = await db.execute(select(User).where(User.email == admin_email))
    if existing_user.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered. Sign in or contact your company admin.",
        )

    existing = await find_existing_company(db, slug=slug, name=payload.company_name)
    if existing is not None:
        admin_emails = await get_owner_emails(db, existing.id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "A company with this name or URL already exists. "
                    "Please contact your company admin to get an account."
                ),
                "admin_emails": admin_emails,
            },
        )

    company = Company(
        slug=slug,
        name=payload.company_name.strip(),
        industry=payload.industry.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(company)
    await db.flush()

    admin = User(
        company_id=company.id,
        name=payload.admin_name.strip(),
        email=admin_email,
        role=UserRole.OWNER,
        password_hash=hash_password(payload.admin_password),
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)

    token = create_access_token(str(admin.id), str(company.id), admin.role.value)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=AuthMeResponse)
async def auth_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuthMeResponse:
    company = await db.get(Company, user.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    return AuthMeResponse(
        user=UserProfile(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            is_admin=user.is_admin,
        ),
        company=CompanyProfile(
            id=company.id,
            slug=company.slug,
            name=company.name,
            industry=company.industry,
            description=company.description,
        ),
    )
