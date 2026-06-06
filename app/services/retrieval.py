from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.company import Company
from app.models.message import Message
from app.services.embeddings import embed_text


async def search_messages(
    db: AsyncSession,
    company: Company,
    query: str,
    limit: int = 5,
) -> list[tuple[Message, float]]:
    query_embedding = await embed_text(query)
    distance = Message.embedding.cosine_distance(query_embedding)

    stmt = (
        select(Message, (1 - distance).label("similarity"))
        .where(Message.company_id == company.id)
        .where(Message.embedding.is_not(None))
        .options(joinedload(Message.author))
        .order_by(distance)
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.unique().all()
    return [(message, float(similarity)) for message, similarity in rows]
