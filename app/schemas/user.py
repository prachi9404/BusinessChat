import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    email: str
    role: UserRole
    created_at: datetime
