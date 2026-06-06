import asyncio

from sqlalchemy import func, select

from app.config import get_settings
from app.db.session import SessionLocal
from app.models.message import Message
from app.services.embeddings import embed_text

settings = get_settings()
BATCH_SIZE = 50


async def backfill() -> None:
    if not settings.openai_api_key:
        print("Embedding backfill skipped: OPENAI_API_KEY not set")
        return

    total_embedded = 0

    while True:
        async with SessionLocal() as session:
            pending = await session.execute(
                select(Message)
                .where(Message.embedding.is_(None))
                .order_by(Message.created_at.asc())
                .limit(BATCH_SIZE)
            )
            messages = list(pending.scalars().all())
            if not messages:
                break

            for message in messages:
                message.embedding = await embed_text(message.content)

            await session.commit()
            total_embedded += len(messages)

    if total_embedded:
        print(f"Embedded {total_embedded} messages")
    else:
        remaining = 0
        async with SessionLocal() as session:
            remaining = await session.scalar(
                select(func.count()).select_from(Message).where(Message.embedding.is_(None))
            )
        if remaining:
            print(f"Embedding backfill incomplete: {remaining} messages still missing embeddings")
        else:
            print("All messages have embeddings")


def main() -> None:
    asyncio.run(backfill())


if __name__ == "__main__":
    main()
