from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.services.auto_apply_service import AutoApplyService
from app.utils.security import get_current_user

router = APIRouter(prefix="/auto-apply", tags=["Automated Job Apply"])


class AutoApplyRequest(BaseModel):
    source: str = "technopark"
    search_query: str = "python"
    page: int = 1
    limit: int = 5


@router.post("")
async def run_auto_apply_pipeline(
    payload: AutoApplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Automated pipeline:
    1. Searches portal (e.g. Technopark or Infopark).
    2. Navigates to details page for each job.
    3. Extracts full description, company, and HR email.
    4. Matches against job titles with LLM failover.
    5. If matching resume not found, creates/synthesizes one automatically!
    6. Generates tailored cover letter.
    7. Applies/prepares application and sends via SMTP if HR contact is available!
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
