from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.job import Job
from app.models.manual_job import ManualJobOwnership


def visible_jobs(user_id: int):
    own_jobs = select(ManualJobOwnership.job_id).where(ManualJobOwnership.user_id == user_id)
    return or_(Job.source != "manual", Job.id.in_(own_jobs))


async def get_accessible_job(job_id: int, user_id: int, db: AsyncSession) -> Job:
    result = await db.execute(select(Job).where(Job.id == job_id, visible_jobs(user_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
