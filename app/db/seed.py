import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.company import Company
from app.models.message import Message
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
        "messages": [
            ("amit@apex.com", "Factory line 2 down for 2 hours — motor bearing failure.", 5),
            ("sneha@apex.com", "Line 1 back to full capacity after yesterday's maintenance.", 4),
            ("amit@apex.com", "Order #4521 shipped to Mumbai distributor.", 3),
            ("ravi@apex.com", "QC flagged batch B-204; holding 120 units pending review.", 2),
            ("sneha@apex.com", "Raw steel delivery delayed from vendor — expect 1-day slip on PO-889.", 1),
            ("amit@apex.com", "Line 2 restarted; running at 80% until QA sign-off.", 0),
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
        "messages": [
            ("karan@horizon.com", "Closed deal with Rajan — 500 units linen, delivery in 10 days.", 5),
            ("divya@horizon.com", "Payment pending from Sharma for invoice #INV-3312.", 4),
            ("karan@horizon.com", "Order #4521 cleared customs at Nhava Sheva.", 3),
            ("priya@horizon.com", "Rajan requested revised payment terms — net-45 instead of net-30.", 2),
            ("divya@horizon.com", "Sharma confirmed partial payment of 60% — balance due Friday.", 1),
            ("karan@horizon.com", "New cotton quote from Gujarat supplier — 3% below last month.", 0),
        ],
    },
]


async def _seed_companies(session) -> dict[str, Company]:
    companies_by_slug: dict[str, Company] = {}

    for entry in SEED_COMPANIES:
        result = await session.execute(select(Company).where(Company.slug == entry["slug"]))
        company = result.scalar_one_or_none()
        if company is None:
            company = Company(
                slug=entry["slug"],
                name=entry["name"],
                industry=entry["industry"],
                description=entry["description"],
            )
            session.add(company)
            await session.flush()

            for user_data in entry["users"]:
                session.add(User(company_id=company.id, **user_data))

        companies_by_slug[entry["slug"]] = company

    return companies_by_slug


async def _seed_messages(session, companies_by_slug: dict[str, Company]) -> int:
    existing = await session.execute(select(Message).limit(1))
    if existing.scalar_one_or_none() is not None:
        return 0

    now = datetime.now(timezone.utc)
    created = 0

    for entry in SEED_COMPANIES:
        company = companies_by_slug[entry["slug"]]
        users_result = await session.execute(select(User).where(User.company_id == company.id))
        users_by_email = {user.email: user for user in users_result.scalars().all()}

        for idx, (author_email, content, days_ago) in enumerate(entry["messages"]):
            author = users_by_email[author_email]
            session.add(
                Message(
                    company_id=company.id,
                    user_id=author.id,
                    content=content,
                    created_at=now - timedelta(days=days_ago, hours=idx + 9),
                )
            )
            created += 1

    return created


async def seed() -> None:
    async with SessionLocal() as session:
        companies_by_slug = await _seed_companies(session)
        message_count = await _seed_messages(session, companies_by_slug)
        await session.commit()

        if message_count:
            print(f"Seeded {message_count} sample messages")
        else:
            print("Seed complete (companies/users/messages already present or messages skipped)")


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
