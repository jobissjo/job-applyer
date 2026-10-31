from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.job import Job
from app.models.manual_job import ManualJobOwnership
from app.models.security import HiddenJob


def accessible_jobs(user_id: int):
    own_jobs = select(ManualJobOwnership.job_id).where(ManualJobOwnership.user_id == user_id)
    return or_(Job.source != "manual", Job.id.in_(own_jobs))


def visible_jobs(user_id: int):
    hidden = select(HiddenJob.job_id).where(HiddenJob.user_id == user_id)
    return and_(accessible_jobs(user_id), ~Job.id.in_(hidden))


async def get_accessible_job(job_id: int, user_id: int, db: AsyncSession) -> Job:
    # Hiding a shared listing must not break saved application workflows.
    result = await db.execute(select(Job).where(Job.id == job_id, accessible_jobs(user_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
