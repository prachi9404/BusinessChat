import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    limit: int = Field(default=8, ge=1, le=20, description="Max source messages to retrieve")


class SourceCitation(BaseModel):
    message_id: uuid.UUID
    author_name: str
    content: str
    created_at: datetime
    similarity: float


class AskResponse(BaseModel):
    qa_log_id: uuid.UUID
    question: str
    answer: str
    company_slug: str
    sources: list[SourceCitation]
    model_used: str


class QALogRead(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    question: str
    answer: str
    source_message_ids: list[uuid.UUID]
    retrieval_snapshot: list[dict]
    model_used: str
    created_at: datetime
