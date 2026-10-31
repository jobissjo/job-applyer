from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


class UserRegister(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_new_password(cls, value: str):
        if len(value) < 8:
            raise ValueError("Use at least 8 characters for your password")
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class VerificationRequest(BaseModel):
    email: EmailStr


class VerifyEmail(VerificationRequest):
    code: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    is_email_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
