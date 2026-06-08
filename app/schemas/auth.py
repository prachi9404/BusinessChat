import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class RegisterRequest(BaseModel):
    company_slug: str = Field(..., min_length=2, max_length=64)
    company_name: str = Field(..., min_length=1, max_length=255)
    industry: str = Field(..., min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    admin_name: str = Field(..., min_length=1, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: UserRole
    is_admin: bool


class CompanyProfile(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    industry: str
    description: str | None


class AuthMeResponse(BaseModel):
    user: UserProfile
    company: CompanyProfile


class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class ManagedUserRead(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: UserRole
    created_at: str


class UpdateUserRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
