import asyncio
from celery import Celery
from app.config import settings

celery_app = Celery("job_applyer", broker=settings.CELERY_BROKER_URL)
celery_app.conf.update(
    timezone="UTC", enable_utc=True,
    beat_schedule={"send-due-applications": {"task": "send_due_applications", "schedule": 30.0}},
)


@celery_app.task(name="send_due_applications", ignore_result=True)
def send_due_applications():
    async def run():
        from app.db.session import AsyncSessionLocal, engine
        from app.services.scheduled_email import dispatch_due
        from app.services.scheduled_follow_up import dispatch_due as dispatch_follow_ups
        try:
            async with AsyncSessionLocal() as db:
                await dispatch_due(db)
                await dispatch_follow_ups(db)
        finally:
            await engine.dispose()
    asyncio.run(run())
