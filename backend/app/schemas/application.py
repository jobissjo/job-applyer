from datetime import date, datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, ConfigDict, AwareDatetime, EmailStr, Field, HttpUrl, field_validator
from datetime import timezone
from app.schemas.job import JobOut
from app.schemas.resume import ResumeOut
from app.schemas.cover_letter import CoverLetterOut
from app.schemas.hr_contact import HRContactOut


class ApplicationSchedule(BaseModel):
    scheduled_at: AwareDatetime

    @field_validator("scheduled_at")
    @classmethod
    def future_time(cls, value):
        if value <= datetime.now(timezone.utc):
            raise ValueError("Choose a future date and time")
        return value.astimezone(timezone.utc)


class ApplicationCreate(BaseModel):
    job_id: int
    resume_id: Optional[int] = None
    cover_letter_id: Optional[int] = None
    cover_letter_content: Optional[str] = None
    hr_contact_id: Optional[int] = None
    email_subject: Optional[str] = None
    notes: Optional[str] = None


class ExternalApplicationCreate(BaseModel):
    request_id: UUID
    role: str = Field(min_length=1, max_length=500)
    company: str = Field(min_length=1, max_length=255)
    applied_on: date
    application_method: str = Field(min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = Field(default=None, max_length=255)
    contact_name: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=100)
    job_url: Optional[HttpUrl] = None
    description: Optional[str] = Field(default=None, max_length=50000)
    notes: Optional[str] = Field(default=None, max_length=50000)

    @field_validator("role", "company", "application_method", "contact_email", "contact_name",
                     "contact_phone", "description", "notes", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("role", "company", "application_method")
    @classmethod
    def single_line(cls, value):
        if "\n" in value or "\r" in value:
            raise ValueError("Must be a single line")
        return value

    @field_validator("job_url")
    @classmethod
    def limit_url_length(cls, value):
        if value is not None and len(str(value)) > 1000:
            raise ValueError("Listing link is too long")
        return value


class ApplicationUpdate(BaseModel):
    resume_id: Optional[int] = None
    cover_letter_id: Optional[int] = None
    cover_letter_content: Optional[str] = None
    hr_contact_id: Optional[int] = None
    email_subject: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ApplicationOut(BaseModel):
    id: int
    user_id: int
    job_id: int
    resume_id: Optional[int] = None
    cover_letter_id: Optional[int] = None
    hr_contact_id: Optional[int] = None
    status: str
    hiring_progress: str = "awaiting_response"
    email_subject: Optional[str] = None
    sent_to: Optional[str] = None
    sent_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None
    applied_on: Optional[date] = None
    application_method: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    job: Optional[JobOut] = None
    resume: Optional[ResumeOut] = None
    cover_letter: Optional[CoverLetterOut] = None
    hr_contact: Optional[HRContactOut] = None

    @field_validator("scheduled_at")
    @classmethod
    def utc_schedule(cls, value):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    model_config = ConfigDict(from_attributes=True)


class ApplicationPreviewResponse(BaseModel):
    application_id: Optional[int] = None
    job_id: int
    job_title: str
    company: str
    recipient_email: Optional[str] = None
    has_hr_contact: bool
    email_subject: str
    cover_letter_text: str
    resume_title: Optional[str] = None
    resume_file_name: Optional[str] = None
    can_send: bool
    reason_cannot_send: Optional[str] = None
