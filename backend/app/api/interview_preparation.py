import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.application import Application
from app.models.interview_preparation import InterviewPreparation, InterviewSection
from app.models.profile import UserProfile
from app.models.resume import Resume
from app.models.user import User
from app.schemas.interview_preparation import GeneratedPreparation, PreparationOut, PreparationRequest, StudyProgressUpdate
from app.services.llm.base import LLMError
from app.services.llm.manager import LLMManager
from app.services.llm.prompts.interview_preparation import INTERVIEW_PREPARATION_SYSTEM_PROMPT
from app.utils.security import get_current_user

router = APIRouter(prefix="/applications/{application_id}/interview-preparation", tags=["Interview preparation"])


async def owned_application(application_id, user_id, db):
    application = (await db.scalars(select(Application).where(
        Application.id == application_id, Application.user_id == user_id,
    ).options(selectinload(Application.job)))).one_or_none()
    if not application:
        raise HTTPException(404, "Application not found")
    return application


async def saved_plan(application_id, db):
    return (await db.scalars(select(InterviewPreparation).where(
        InterviewPreparation.application_id == application_id,
    ).execution_options(populate_existing=True))).one_or_none()


@router.get("", response_model=PreparationOut | None)
async def get_preparation(application_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_application(application_id, user.id, db)
    return await saved_plan(application_id, db)


@router.post("", response_model=PreparationOut)
async def generate_preparation(application_id: int, payload: PreparationRequest,
                               user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_id = user.id
    application = await owned_application(application_id, user_id, db)
    previous = await saved_plan(application_id, db)
    if (previous and str(payload.replace_generation) != previous.generation_id) or (not previous and payload.replace_generation):
        raise HTTPException(409, "The preparation plan changed. Reload it before generating a replacement.")
    previous_id = previous.id if previous else None
    previous_generation = previous.generation_id if previous else None
    resume_id = payload.resume_id if "resume_id" in payload.model_fields_set else application.resume_id
    resume = None
    if resume_id is not None:
        resume = await db.get(Resume, resume_id)
        if not resume or resume.user_id != user_id:
            raise HTTPException(404, "Resume not found")
        if not resume.extracted_text or not resume.extracted_text.strip():
            raise HTTPException(422, "This resume has no readable text. Choose another resume or generate without one.")
    profile = (await db.scalars(select(UserProfile).where(UserProfile.user_id == user_id))).one_or_none()
    job = application.job
    # Only job-relevant profile fields are sent, omitting salary and contact details.
    prompt = json.dumps({
        "job": {"title": job.title, "company": job.company, "description": (job.description or "")[:30000],
                "requirements": (job.requirements or "")[:15000]},
        "resume": resume.extracted_text[:30000] if resume else None,
        "profile": {"years_of_experience": profile.years_of_experience,
                    "current_company": profile.current_company,
                    "additional_details": (profile.additional_details or "")[:10000]} if profile else None,
        "interview_context": payload.context,
    })
    resume_title = resume.title if resume else None
    try:
        raw = await LLMManager.generate_with_failover(user_id=user_id, prompt=prompt, json_mode=True,
            system_instruction=INTERVIEW_PREPARATION_SYSTEM_PROMPT, db=db)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        generated = GeneratedPreparation.model_validate_json(cleaned)
    except (ValidationError, ValueError, IndexError):
        raise HTTPException(502, "The AI returned an incomplete or invalid study plan. Please try again. Your saved plan is unchanged.")
    except LLMError as exc:
        raise HTTPException(502, str(exc))

    values = dict(generation_id=str(uuid4()), summary=generated.summary, context=payload.context,
                  resume_id=resume_id, resume_title=resume_title)
    if previous_id is not None:
        # Do not overwrite a newer generation if two AI requests finish out of order.
        claimed = await db.execute(update(InterviewPreparation).where(
            InterviewPreparation.id == previous_id, InterviewPreparation.generation_id == previous_generation,
        ).values(**values).execution_options(synchronize_session=False))
        if not claimed.rowcount:
            await db.rollback()
            raise HTTPException(409, "A newer plan was saved while generating. Reload to see it.")
        await db.execute(delete(InterviewSection).where(InterviewSection.preparation_id == previous_id))
        plan_id = previous_id
    else:
        plan = InterviewPreparation(application_id=application_id, **values)
        db.add(plan)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(409, "A preparation plan was already saved. Reload to see it.")
        plan_id = plan.id
    sections = sorted(generated.sections, key=lambda section: {"high": 0, "medium": 1, "low": 2}[section.priority])
    for position, section in enumerate(sections):
        db.add(InterviewSection(preparation_id=plan_id, position=position, **section.model_dump()))
    await db.commit()
    return await saved_plan(application_id, db)


@router.patch("/sections/{section_id}", response_model=PreparationOut)
async def update_progress(application_id: int, section_id: int, payload: StudyProgressUpdate,
                          user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_application(application_id, user.id, db)
    plan_query = select(InterviewPreparation.id).where(
        InterviewPreparation.application_id == application_id,
        InterviewPreparation.generation_id == str(payload.generation_id),
    )
    changed = await db.execute(update(InterviewSection).where(
        InterviewSection.id == section_id, InterviewSection.preparation_id.in_(plan_query),
    ).values(completed=payload.completed))
    if not changed.rowcount:
        await db.rollback()
        raise HTTPException(409, "This study section changed. Reload the preparation plan.")
    await db.commit()
    return await saved_plan(application_id, db)
