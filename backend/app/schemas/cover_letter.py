from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CoverLetterGenerateRequest(BaseModel):
    job_id: Optional[int] = None
    job_title_id: Optional[int] = None
    resume_id: Optional[int] = None
    custom_instructions: Optional[str] = None


class CoverLetterCreate(BaseModel):
    job_id: int
    job_title: str
    resume_id: Optional[int] = None
    content: str


class CoverLetterUpdate(BaseModel):
    content: str


class CoverLetterOut(BaseModel):
    id: int
    user_id: int
    job_id: int
    job_title: str
    resume_id: Optional[int] = None
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
