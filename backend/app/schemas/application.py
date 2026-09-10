from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.job import JobOut
from app.schemas.resume import ResumeOut
from app.schemas.cover_letter import CoverLetterOut
from app.schemas.hr_contact import HRContactOut


class ApplicationCreate(BaseModel):
    job_id: int
    resume_id: Optional[int] = None
    cover_letter_id: Optional[int] = None
    hr_contact_id: Optional[int] = None
    email_subject: Optional[str] = None
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    resume_id: Optional[int] = None
    cover_letter_id: Optional[int] = None
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
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    job: Optional[JobOut] = None
    resume: Optional[ResumeOut] = None
    cover_letter: Optional[CoverLetterOut] = None
    hr_contact: Optional[HRContactOut] = None

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
