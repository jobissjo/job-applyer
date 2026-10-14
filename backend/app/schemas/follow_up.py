from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, AwareDatetime, Field, field_validator


class FollowUpCreate(BaseModel):
    request_id: UUID
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=20000)
    attach_resume: bool = False
    scheduled_at: Optional[AwareDatetime] = None

    @field_validator("scheduled_at")
    @classmethod
    def future_time(cls, value):
        if value is not None:
            if value <= datetime.now(timezone.utc):
                raise ValueError("Choose a future date and time")
            return value.astimezone(timezone.utc)
        return value

    @field_validator("subject", "body")
    @classmethod
    def require_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Must not be blank")
        return value

    @field_validator("subject")
    @classmethod
    def single_line_subject(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("Subject must be a single line")
        return value


class FollowUpOut(BaseModel):
    id: int
    application_id: int
    recipient: str
    subject: str
    body: str
    attach_resume: bool
    status: str
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("sent_at", "created_at", "scheduled_at")
    @classmethod
    def utc_timestamps(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
