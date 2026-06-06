import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    limit: int = Field(default=5, ge=1, le=20)


class SearchResult(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    user_id: uuid.UUID
    author_name: str
    content: str
    created_at: datetime
    similarity: float = Field(..., description="Cosine similarity (1.0 = identical meaning)")


class SearchResponse(BaseModel):
    query: str
    company_slug: str
    results: list[SearchResult]
