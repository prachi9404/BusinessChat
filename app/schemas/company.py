import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserRead


class CompanyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    industry: str
    description: str | None
    created_at: datetime


class CompanyDetail(CompanyRead):
    users: list[UserRead] = []
