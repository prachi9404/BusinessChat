import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.user import User, UserRole
from app.schemas.auth import CreateUserRequest, ManagedUserRead, UpdateUserRequest
from app.services.auth import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[ManagedUserRead])
async def list_company_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ManagedUserRead]:
    result = await db.execute(
        select(User).where(User.company_id == admin.company_id).order_by(User.created_at.asc())
    )
    users = result.scalars().all()
    return [
        ManagedUserRead(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            created_at=user.created_at.isoformat(),
        )
        for user in users
    ]


@router.post("", response_model=ManagedUserRead, status_code=status.HTTP_201_CREATED)
async def create_company_user(
    payload: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ManagedUserRead:
    email = str(payload.email).lower()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="This email is already registered to another account.",
        )

    user = User(
        company_id=admin.company_id,
        name=payload.name.strip(),
        email=email,
        role=UserRole.MEMBER,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return ManagedUserRead(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        created_at=user.created_at.isoformat(),
    )


def _to_managed_user_read(user: User) -> ManagedUserRead:
    return ManagedUserRead(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        created_at=user.created_at.isoformat(),
    )


@router.patch("/{user_id}", response_model=ManagedUserRead)
async def update_company_user(
    user_id: uuid.UUID,
    payload: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ManagedUserRead:
    result = await db.execute(
        select(User).where(User.id == user_id, User.company_id == admin.company_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.name is not None:
        user.name = payload.name.strip()

    if payload.email is not None:
        email = str(payload.email).lower()
        if email != user.email:
            existing = await db.execute(select(User).where(User.email == email))
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=409,
                    detail="This email is already registered to another account.",
                )
            user.email = email

    if payload.password is not None:
        user.password_hash = hash_password(payload.password)

    if payload.name is None and payload.email is None and payload.password is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.commit()
    await db.refresh(user)
    return _to_managed_user_read(user)
