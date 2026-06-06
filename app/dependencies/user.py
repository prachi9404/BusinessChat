import uuid

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.tenant import get_current_company
from app.models.company import Company
from app.models.user import User


async def get_current_user(
    x_user_id: str = Header(..., description="UUID of the posting user"),
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        user_uuid = uuid.UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-User-Id must be a valid UUID",
        ) from exc

    result = await db.execute(
        select(User).where(User.id == user_uuid, User.company_id == company.id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this company",
        )
    return user
