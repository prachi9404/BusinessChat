from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.dependencies.tenant import get_current_company_detail
from app.models.company import Company
from app.schemas.company import CompanyDetail, CompanyRead

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=list[CompanyRead])
async def list_companies(db: AsyncSession = Depends(get_db)) -> list[Company]:
    result = await db.execute(select(Company).order_by(Company.name))
    return list(result.scalars().all())


@router.get("/me", response_model=CompanyDetail)
async def get_my_company(company: Company = Depends(get_current_company_detail)) -> Company:
    return company
