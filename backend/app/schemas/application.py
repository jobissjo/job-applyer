from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, AwareDatetime, field_validator
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
    email_subject: Optional[str] = None
    sent_to: Optional[str] = None
    sent_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None
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
