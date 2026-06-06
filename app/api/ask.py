import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_db
from app.dependencies.tenant import get_current_company
from app.models.company import Company
from app.models.qa_log import QALog
from app.schemas.ask import AskRequest, AskResponse, QALogRead, SourceCitation
from app.services.llm import generate_answer
from app.services.retrieval import search_messages

router = APIRouter(tags=["ask"])
settings = get_settings()


def _build_sources(matches: list) -> list[SourceCitation]:
    return [
        SourceCitation(
            message_id=message.id,
            author_name=message.author.name,
            content=message.content,
            created_at=message.created_at,
            similarity=round(similarity, 4),
        )
        for message, similarity in matches
    ]


def _build_retrieval_snapshot(matches: list) -> list[dict]:
    return [
        {
            "message_id": str(message.id),
            "author_name": message.author.name,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
            "similarity": round(similarity, 4),
        }
        for message, similarity in matches
    ]


@router.post("/ask", response_model=AskResponse)
async def ask_owner_question(
    payload: AskRequest,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
) -> AskResponse:
    question = payload.question.strip()
    matches = await search_messages(
        db=db,
        company=company,
        query=question,
        limit=payload.limit,
    )

    answer = await generate_answer(company=company, question=question, messages=matches)
    sources = _build_sources(matches)

    qa_log = QALog(
        company_id=company.id,
        question=question,
        answer=answer,
        source_message_ids=[str(source.message_id) for source in sources],
        retrieval_snapshot=_build_retrieval_snapshot(matches),
        model_used=settings.chat_model,
    )

    db.add(qa_log)
    await db.commit()
    await db.refresh(qa_log)

    return AskResponse(
        qa_log_id=qa_log.id,
        question=question,
        answer=answer,
        company_slug=company.slug,
        sources=sources,
        model_used=qa_log.model_used,
    )


@router.get("/qa/{qa_log_id}", response_model=QALogRead)
async def get_qa_log(
    qa_log_id: uuid.UUID,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
) -> QALogRead:
    result = await db.execute(
        select(QALog).where(QALog.id == qa_log_id, QALog.company_id == company.id)
    )
    qa_log = result.scalar_one_or_none()
    if qa_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Q&A record not found")

    return QALogRead(
        id=qa_log.id,
        company_id=qa_log.company_id,
        question=qa_log.question,
        answer=qa_log.answer,
        source_message_ids=[uuid.UUID(message_id) for message_id in qa_log.source_message_ids],
        retrieval_snapshot=qa_log.retrieval_snapshot,
        model_used=qa_log.model_used,
        created_at=qa_log.created_at,
    )
