import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.user import User, UserRole

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def normalize_slug(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def is_valid_slug(slug: str) -> bool:
    return bool(slug) and len(slug) <= 64 and SLUG_PATTERN.match(slug) is not None


async def find_existing_company(
    db: AsyncSession,
    *,
    slug: str,
    name: str,
) -> Company | None:
    slug_result = await db.execute(select(Company).where(Company.slug == slug))
    company = slug_result.scalar_one_or_none()
    if company is not None:
        return company

    name_result = await db.execute(
        select(Company).where(func.lower(Company.name) == name.strip().lower())
    )
    return name_result.scalar_one_or_none()


async def get_owner_emails(db: AsyncSession, company_id) -> list[str]:
    result = await db.execute(
        select(User.email).where(User.company_id == company_id, User.role == UserRole.OWNER)
    )
    return [email for (email,) in result.all()]
