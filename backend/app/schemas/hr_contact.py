from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class HRContactCreate(BaseModel):
    job_id: int
    company: Optional[str] = None
    contact_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    notes: Optional[str] = None


class HRContactUpdate(BaseModel):
    company: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class HRContactOut(BaseModel):
    id: int
    user_id: int
    job_id: int
    company: Optional[str] = None
    contact_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    source: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
