from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.job_title import JobTitleOut


class ResumeJobTitleLink(BaseModel):
    job_title_ids: List[int]


class ResumeUpdate(BaseModel):
    title: Optional[str] = None
    active: Optional[bool] = None
    job_title_ids: Optional[List[int]] = None


class ResumeOut(BaseModel):
    id: int
    user_id: int
    title: str
    file_name: str
    file_path: str
    resume_type: str
    extracted_text: Optional[str] = None
    active: bool
    created_at: datetime
    updated_at: datetime
    mapped_job_titles: List[JobTitleOut] = []

    model_config = ConfigDict(from_attributes=True)
