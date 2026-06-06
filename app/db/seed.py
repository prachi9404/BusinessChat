import asyncio

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.company import Company
from app.models.user import User, UserRole

SEED_COMPANIES = [
    {
        "slug": "apex-manufacturing",
        "name": "Apex Manufacturing",
        "industry": "manufacturing",
        "description": "Industrial parts manufacturer with three factory lines.",
        "users": [
            {"name": "Ravi Sharma", "email": "ravi@apex.com", "role": UserRole.OWNER},
            {"name": "Amit Patel", "email": "amit@apex.com", "role": UserRole.MEMBER},
            {"name": "Sneha Reddy", "email": "sneha@apex.com", "role": UserRole.MEMBER},
        ],
    },
    {
        "slug": "horizon-trading",
        "name": "Horizon Trading Co.",
        "industry": "trading",
        "description": "Import/export trading firm focused on textiles and commodities.",
        "users": [
            {"name": "Priya Mehta", "email": "priya@horizon.com", "role": UserRole.OWNER},
            {"name": "Karan Singh", "email": "karan@horizon.com", "role": UserRole.MEMBER},
            {"name": "Divya Nair", "email": "divya@horizon.com", "role": UserRole.MEMBER},
        ],
    },
]


async def seed() -> None:
    async with SessionLocal() as session:
        existing = await session.execute(select(Company).limit(1))
        if existing.scalar_one_or_none() is not None:
            print("Seed skipped: companies already exist")
            return

        for entry in SEED_COMPANIES:
            users_data = entry["users"]
            company = Company(
                slug=entry["slug"],
                name=entry["name"],
                industry=entry["industry"],
                description=entry["description"],
            )
            session.add(company)
            await session.flush()

            for user_data in users_data:
                session.add(User(company_id=company.id, **user_data))

        await session.commit()
        print(f"Seeded {len(SEED_COMPANIES)} companies with users")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
