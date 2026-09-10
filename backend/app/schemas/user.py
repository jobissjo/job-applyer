from typing import Optional
from pydantic import BaseModel, ConfigDict


class UserProfileBase(BaseModel):
    name: str = ""
    phone: Optional[str] = None
    current_company: Optional[str] = None
    current_ctc: Optional[str] = None
    expected_ctc: Optional[str] = None
    location: Optional[str] = None
    years_of_experience: Optional[float] = None
    notice_period: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    additional_details: Optional[str] = None


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfileOut(UserProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)
