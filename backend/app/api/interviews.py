from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, exists, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.applications import get_application_by_id
from app.db.session import get_db
from app.models.application import Application
from app.models.interview import InterviewRound, InterviewChange
from app.models.user import User
from app.schemas.application import ApplicationOut
from app.schemas.interview import ProgressUpdate, RoundInput, RoundOut, ChangeOut, InterviewTrackingOut
from app.utils.security import get_current_user

router = APIRouter(tags=["Interviews"])


async def owned_application(application_id, user, db):
    app = (await db.execute(select(Application).where(
        Application.id == application_id, Application.user_id == user.id,
    ).with_for_update())).scalar_one_or_none()
    if app is None:
        raise HTTPException(404, "Application not found")
    if app.status not in ("sent", "applied_externally"):
        raise HTTPException(409, "Interview tracking is available after applying")
    return app


async def tracking(application_id, user, db):
    application = await get_application_by_id(application_id, user, db)
    rounds = (await db.execute(select(InterviewRound).where(
        InterviewRound.application_id == application_id,
    ).order_by(InterviewRound.created_at, InterviewRound.id))).scalars().all()
    history = (await db.execute(select(InterviewChange).where(
        InterviewChange.application_id == application_id,
    ).order_by(InterviewChange.created_at.desc(), InterviewChange.id.desc()))).scalars().all()
    return InterviewTrackingOut(application=application,
                                rounds=[RoundOut.model_validate(r) for r in rounds],
                                history=[ChangeOut.model_validate(h) for h in history])


@router.get("/interviews", response_model=list[InterviewTrackingOut])
async def list_interviews(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    applications = (await db.execute(select(Application).options(
        selectinload(Application.job), selectinload(Application.resume),
        selectinload(Application.cover_letter), selectinload(Application.hr_contact),
    ).where(
        Application.user_id == current_user.id,
        Application.status.in_(("sent", "applied_externally")),
        or_(Application.hiring_progress != "awaiting_response",
            exists().where(InterviewChange.application_id == Application.id)),
    ).order_by(Application.updated_at.desc(), Application.id.desc()))).scalars().all()
    if not applications:
        return []
    ids = [application.id for application in applications]
    rounds_by_app = {i: [] for i in ids}
    history_by_app = {i: [] for i in ids}
    rounds = (await db.execute(select(InterviewRound).where(
        InterviewRound.application_id.in_(ids),
    ).order_by(InterviewRound.created_at, InterviewRound.id))).scalars().all()
    for round in rounds:
        rounds_by_app[round.application_id].append(RoundOut.model_validate(round))
    changes = (await db.execute(select(InterviewChange).where(
        InterviewChange.application_id.in_(ids),
    ).order_by(InterviewChange.created_at.desc(), InterviewChange.id.desc()))).scalars().all()
    for change in changes:
        history_by_app[change.application_id].append(ChangeOut.model_validate(change))
    return [InterviewTrackingOut(application=ApplicationOut.model_validate(application),
                                 rounds=rounds_by_app[application.id], history=history_by_app[application.id])
            for application in applications]


@router.get("/applications/{application_id}/interviews", response_model=InterviewTrackingOut)
async def get_interviews(application_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await owned_application(application_id, current_user, db)
    return await tracking(application_id, current_user, db)


@router.patch("/applications/{application_id}/hiring-progress", response_model=InterviewTrackingOut)
async def update_progress(application_id: int, payload: ProgressUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    app = await owned_application(application_id, current_user, db)
    if app.hiring_progress != payload.progress:
        db.add(InterviewChange(application_id=app.id, description="Hiring progress updated",
                               before={"progress": app.hiring_progress}, after={"progress": payload.progress}))
        app.hiring_progress = payload.progress
        app.updated_at = datetime.now(timezone.utc)
        await db.commit()
    return await tracking(application_id, current_user, db)


async def save_round(application_id, payload, round_id, user, db):
    app = await owned_application(application_id, user, db)
    before = {}
    if round_id is not None:
        round = (await db.execute(select(InterviewRound).where(
            InterviewRound.id == round_id, InterviewRound.application_id == application_id,
        ))).scalar_one_or_none()
        if round is None:
            raise HTTPException(404, "Interview round not found")
        before = RoundOut.model_validate(round).model_dump(mode="json", include=set(RoundInput.model_fields))
    else:
        round = InterviewRound(application_id=application_id)
        db.add(round)
    for key, value in payload.model_dump().items():
        setattr(round, key, value)
    after = payload.model_dump(mode="json")
    if before != after:
        await db.flush()
        db.add(InterviewChange(application_id=application_id, round_id=round.id,
                               description=f'{"Added" if round_id is None else "Updated"} round: {round.name}',
                               before=before, after=after))
        if app.hiring_progress in ("awaiting_response", "callback_received"):
            db.add(InterviewChange(application_id=application_id, description="Interview process started",
                                   before={"progress": app.hiring_progress}, after={"progress": "interviewing"}))
            app.hiring_progress = "interviewing"
        app.updated_at = datetime.now(timezone.utc)
        await db.commit()
    return await tracking(application_id, user, db)


@router.post("/applications/{application_id}/interviews", response_model=InterviewTrackingOut, status_code=201)
async def create_round(application_id: int, payload: RoundInput, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await save_round(application_id, payload, None, current_user, db)


@router.put("/applications/{application_id}/interviews/{round_id}", response_model=InterviewTrackingOut)
async def update_round(application_id: int, round_id: int, payload: RoundInput, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await save_round(application_id, payload, round_id, current_user, db)
