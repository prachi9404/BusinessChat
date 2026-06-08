import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.session import get_db
from app.dependencies.auth import get_current_company, get_current_user
from app.models.company import Company
from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCreate, MessageRead
from app.services.embeddings import embed_text

router = APIRouter(prefix="/messages", tags=["messages"])


def _to_message_read(message: Message) -> MessageRead:
    return MessageRead(
        id=message.id,
        company_id=message.company_id,
        user_id=message.user_id,
        author_name=message.author.name,
        content=message.content,
        created_at=message.created_at,
    )


@router.post("", response_model=MessageRead, status_code=201)
async def create_message(
    payload: MessageCreate,
    company: Company = Depends(get_current_company),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageRead:
    content = payload.content.strip()
    message = Message(
        company_id=company.id,
        user_id=user.id,
        content=content,
        embedding=await embed_text(content),
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    message.author = user
    return _to_message_read(message)


@router.get("", response_model=list[MessageRead])
async def list_messages(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID | None = Query(default=None, description="Filter by author"),
    from_date: datetime | None = Query(default=None, description="Inclusive start (ISO 8601)"),
    to_date: datetime | None = Query(default=None, description="Inclusive end (ISO 8601)"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[MessageRead]:
    query = (
        select(Message)
        .where(Message.company_id == company.id)
        .options(joinedload(Message.author))
        .order_by(Message.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    if user_id is not None:
        query = query.where(Message.user_id == user_id)
    if from_date is not None:
        query = query.where(Message.created_at >= from_date)
    if to_date is not None:
        query = query.where(Message.created_at <= to_date)

    result = await db.execute(query)
    messages = result.scalars().unique().all()
    return [_to_message_read(message) for message in messages]
