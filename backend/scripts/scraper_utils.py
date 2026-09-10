import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from datetime import datetime, timezone
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal, init_db
from app.models.job import Job
from app.services.scraper.base import ScrapedJob
from app.utils.logger import logger


async def upsert_scraped_jobs(scraped_jobs: List[ScrapedJob]) -> tuple[int, int]:
    """
    Upserts scraped jobs into the database.
    Returns (inserted_count, updated_count).
    """
    await init_db()
    inserted = 0
    updated = 0

    async with AsyncSessionLocal() as session:
        for sj in scraped_jobs:
            stmt = select(Job).where(
                Job.source == sj.source,
                Job.source_job_id == sj.source_job_id
            )
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            if existing:
                existing.title = sj.title
                existing.company = sj.company
                existing.location = sj.location
                existing.job_url = sj.job_url
                existing.detail_url = sj.detail_url
                if sj.description:
                    existing.description = sj.description
                if sj.requirements:
                    existing.requirements = sj.requirements
                if sj.contact_email:
                    existing.contact_email = sj.contact_email
                if sj.contact_phone:
                    existing.contact_phone = sj.contact_phone
                if sj.posted_date:
                    existing.posted_date = sj.posted_date
                existing.scraped_at = datetime.now(timezone.utc)
                if sj.raw_data:
                    existing.raw_data = sj.raw_data
                updated += 1
            else:
                new_job = Job(
                    source=sj.source,
                    source_job_id=sj.source_job_id,
                    title=sj.title,
                    company=sj.company,
                    location=sj.location,
                    job_url=sj.job_url,
                    detail_url=sj.detail_url,
                    description=sj.description,
                    requirements=sj.requirements,
                    contact_name=sj.contact_name,
                    contact_email=sj.contact_email,
                    contact_phone=sj.contact_phone,
                    posted_date=sj.posted_date,
                    scraped_at=datetime.now(timezone.utc),
                    raw_data=sj.raw_data
                )
                session.add(new_job)
                inserted += 1

        await session.commit()

    return inserted, updated
