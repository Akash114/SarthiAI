"""Request/response models for auth routes."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=256)

    @field_validator("password")
    @classmethod
    def password_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("password must not be empty")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class MergeAnonymousRequest(BaseModel):
    anonymous_user_id: UUID


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: UUID
    request_id: str = ""


class AuthMeResponse(BaseModel):
    user_id: UUID
    email: str | None = None
    request_id: str = ""


class MergeAnonymousResponse(BaseModel):
    merged: bool
    authenticated_user_id: UUID
    message: str = ""
    request_id: str = ""
