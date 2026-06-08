from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import get_current_company, require_admin
from app.models.company import Company
from app.models.user import User
from app.schemas.search import SearchRequest, SearchResponse, SearchResult
from app.services.retrieval import search_messages

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def semantic_search(
    payload: SearchRequest,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> SearchResponse:
    matches = await search_messages(
        db=db,
        company=company,
        query=payload.query.strip(),
        limit=payload.limit,
    )

    results = [
        SearchResult(
            id=message.id,
            company_id=message.company_id,
            user_id=message.user_id,
            author_name=message.author.name,
            content=message.content,
            created_at=message.created_at,
            similarity=round(similarity, 4),
        )
        for message, similarity in matches
    ]

    return SearchResponse(
        query=payload.query,
        company_slug=company.slug,
        results=results,
    )
