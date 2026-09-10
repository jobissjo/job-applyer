from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


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
