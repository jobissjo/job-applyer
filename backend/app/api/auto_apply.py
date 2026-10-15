from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.services.auto_apply_service import AutoApplyService
from app.services.scraper.registry import SCRAPERS
from app.utils.security import get_current_user

router = APIRouter(prefix="/auto-apply", tags=["Automated Job Apply"])


class AutoApplyRequest(BaseModel):
    source: str = "technopark"
    search_query: str = "python"
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=5, ge=1, le=20)

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        value = value.lower().strip()
        if value not in SCRAPERS:
            raise ValueError("Unsupported job source")
        return value


@router.post("")
async def run_auto_apply_pipeline(
    payload: AutoApplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Automated pipeline:
    1. Searches the selected IT park's company vacancies.
    2. Navigates to details page for each job.
    3. Extracts full description, company, and HR email.
    4. Matches against job titles with LLM failover.
    5. If matching resume not found, creates/synthesizes one automatically!
    6. Generates tailored cover letter.
    7. Prepares applications for review; sending or scheduling requires explicit approval.
    """
    try:
        report = await AutoApplyService.run_pipeline(
            user_id=current_user.id,
            source=payload.source,
            query=payload.search_query,
            page=payload.page,
            limit=payload.limit,
            db=db
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-apply pipeline failed: {str(e)}")
