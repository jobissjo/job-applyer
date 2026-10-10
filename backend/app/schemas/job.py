from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator


class ManualJobCreate(BaseModel):
    request_id: UUID
    role: str = Field(min_length=1, max_length=500)
    email: EmailStr = Field(max_length=255)
    description: str = Field(min_length=1, max_length=50000)
    company: Optional[str] = Field(default=None, max_length=255)
    job_url: Optional[HttpUrl] = None

    @field_validator("role", "description", "company", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("role")
    @classmethod
    def single_line_role(cls, value: str) -> str:
        if "\n" in value or "\r" in value:
            raise ValueError("Role must be a single line")
        return value

    @field_validator("job_url")
    @classmethod
    def limit_url_length(cls, value):
        if value is not None and len(str(value)) > 1000:
            raise ValueError("Listing link is too long")
        return value


class JobBase(BaseModel):
    source: str
    source_job_id: str
    title: str
    company: str
    location: Optional[str] = None
    job_url: str
    detail_url: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    posted_date: Optional[str] = None


class JobOut(JobBase):
    id: int
    scraped_at: datetime
    created_at: datetime
    updated_at: datetime
    raw_data: Optional[str] = None
    has_hr_contact: bool = False
    is_applied: bool = False
    application_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class JobPaginationResponse(BaseModel):
    items: List[JobOut]
    page: int
    limit: int
    total: int
    has_next: bool


class JobAnalyzeResponse(BaseModel):
    matched: bool
    job_title: Optional[str] = None
    job_title_id: Optional[int] = None
    match_score: int
    reason: str
    recommended_resume_id: Optional[int] = None
    recommended_resume_title: Optional[str] = None
    has_hr_contact: bool
    hr_email: Optional[str] = None
