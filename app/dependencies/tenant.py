from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.company import Company


async def get_current_company(
    x_company_slug: str = Header(..., description="Tenant slug, e.g. apex-manufacturing"),
    db: AsyncSession = Depends(get_db),
) -> Company:
    result = await db.execute(
        select(Company).where(Company.slug == x_company_slug)
    )
    company = result.scalar_one_or_none()
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company '{x_company_slug}' not found",
        )
    return company


async def get_current_company_detail(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
) -> Company:
    result = await db.execute(
        select(Company)
        .where(Company.id == company.id)
        .options(selectinload(Company.users))
    )
    return result.scalar_one()
