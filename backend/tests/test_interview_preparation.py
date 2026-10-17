import json
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.application import Application
from app.models.interview_preparation import InterviewPreparation, InterviewSection
from app.models.resume import Resume
from app.services.llm.base import LLMError

pytestmark = pytest.mark.asyncio


def generated_plan():
    def section(title, priority):
        return {"title": title, "priority": priority, "reason": "The job explicitly requires Python and FastAPI.",
                "estimated_minutes": 45, "topics": ["Dependency injection", "Async request handlers"],
                "practice_tasks": ["Implement and test a small API endpoint."],
                "questions": [{"question": "How do async endpoints work?", "answer_guide": "Discuss I/O, await and blocking calls."}]}
    return {"summary": "Prioritize FastAPI and prepare examples from actual projects.",
            "sections": [section("Project discussion", "medium"), section("FastAPI fundamentals", "high")]}


async def make_application(db, user, job, **fields):
    application = Application(user_id=user["user"].id, job_id=job.id, status="sent", **fields)
    db.add(application)
    await db.commit()
    return f"/api/applications/{application.id}/interview-preparation", application


async def test_saved_plan_uses_job_resume_profile_and_tracks_progress(client, db_session, user_a, sample_job):
    resume = Resume(user_id=user_a["user"].id, title="Backend resume", file_name="r.pdf", file_path="unused", extracted_text="Built Python APIs and SQL integrations.")
    db_session.add(resume)
    await db_session.commit()
    path, application = await make_application(db_session, user_a, sample_job, resume_id=resume.id)
    headers = user_a["headers"]
    assert (await client.get(path, headers=headers)).json() is None
    ai = AsyncMock(return_value='```json\n' + json.dumps(generated_plan()) + '\n```')
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", ai):
        response = await client.post(path, headers=headers, json={"context": "Coding round in 3 days; one hour each day."})
    assert response.status_code == 200, response.text
    plan = response.json()
    assert plan["resume_id"] == resume.id
    assert plan["resume_title"] == "Backend resume"
    assert plan["sections"][0]["title"] == "FastAPI fundamentals"
    assert all(not section["completed"] for section in plan["sections"])
    prompt = json.loads(ai.call_args.kwargs["prompt"])
    assert prompt["resume"] == resume.extracted_text
    assert prompt["job"]["description"] == sample_job.description
    assert prompt["profile"]["current_company"] == "Alpha Corp"
    assert prompt["interview_context"] == plan["context"]
    assert "current_ctc" not in prompt["profile"]
    assert ai.call_args.kwargs["json_mode"] is True
    section = plan["sections"][0]
    progress_path = f"{path}/sections/{section['id']}"
    for completed in [True, False, True]:
        changed = await client.patch(progress_path, headers=headers, json={"generation_id": plan["generation_id"], "completed": completed})
        assert changed.status_code == 200, changed.text
        assert changed.json()["sections"][0]["completed"] is completed
    saved = await client.get(path, headers=headers)
    assert saved.json()["sections"][0]["completed"] is True
    assert saved.json()["sections"][0]["questions"][0]["answer_guide"]
    await db_session.refresh(application)
    assert application.status == "sent"
    assert application.resume_id == resume.id


async def test_external_application_can_prepare_without_resume(client, user_a):
    headers = user_a["headers"]
    external = await client.post("/api/applications/external", headers=headers, json={
        "request_id": str(uuid4()), "role": "Designer", "company": "Example Co",
        "applied_on": "2026-10-12", "application_method": "Website",
    })
    application = external.json()
    path = f"/api/applications/{application['id']}/interview-preparation"
    ai = AsyncMock(return_value=json.dumps(generated_plan()))
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", ai):
        response = await client.post(path, headers=headers, json={"resume_id": None})
    assert response.status_code == 200, response.text
    assert response.json()["resume_id"] is None
    assert json.loads(ai.call_args.kwargs["prompt"])["resume"] is None
    saved_application = (await client.get(f"/api/applications/{application['id']}", headers=headers)).json()
    assert saved_application["status"] == "applied_externally"
    assert saved_application["sent_at"] is None


async def test_privacy_and_resume_ownership(client, db_session, user_a, user_b, sample_job):
    path, application = await make_application(db_session, user_a, sample_job)
    other_path, _ = await make_application(db_session, user_b, sample_job)
    resume = Resume(user_id=user_b["user"].id, title="Private resume", file_name="r.pdf", file_path="unused", extracted_text="Private experience")
    db_session.add(resume)
    await db_session.commit()
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(return_value=json.dumps(generated_plan()))) as ai:
        assert (await client.get(path, headers=user_b["headers"])).status_code == 404
        assert (await client.post(path, headers=user_b["headers"], json={})).status_code == 404
        assert (await client.post(path, headers=user_a["headers"], json={"resume_id": resume.id})).status_code == 404
        ai.assert_not_called()
        plan = (await client.post(path, headers=user_a["headers"], json={})).json()
        section_path = f"/sections/{plan['sections'][0]['id']}"
        payload = {"generation_id": plan["generation_id"], "completed": True}
        assert (await client.patch(path + section_path, headers=user_b["headers"], json=payload)).status_code == 404
        assert (await client.patch(other_path + section_path, headers=user_b["headers"], json=payload)).status_code == 409
        # Reading a saved plan never calls AI again.
        ai.reset_mock()
        assert (await client.get(path, headers=user_a["headers"])).status_code == 200
        ai.assert_not_called()
    assert (await client.get(path)).status_code == 401


async def test_replace_is_explicit_and_invalid_ai_preserves_completed_plan(client, db_session, user_a, sample_job):
    path, _ = await make_application(db_session, user_a, sample_job)
    headers = user_a["headers"]
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(return_value=json.dumps(generated_plan()))):
        plan = (await client.post(path, headers=headers, json={})).json()
    await client.patch(f"{path}/sections/{plan['sections'][0]['id']}", headers=headers,
                       json={"generation_id": plan["generation_id"], "completed": True})
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(return_value="not json")) as ai:
        assert (await client.post(path, headers=headers, json={})).status_code == 409
        ai.assert_not_called()
        failed = await client.post(path, headers=headers, json={"replace_generation": plan["generation_id"]})
        assert failed.status_code == 502
    preserved = (await client.get(path, headers=headers)).json()
    assert preserved["generation_id"] == plan["generation_id"]
    assert preserved["sections"][0]["completed"] is True
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(return_value=json.dumps(generated_plan()))):
        replaced = await client.post(path, headers=headers, json={"replace_generation": plan["generation_id"], "context": "Final round tomorrow"})
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()["generation_id"] != plan["generation_id"]
    assert all(not section["completed"] for section in replaced.json()["sections"])
    assert (await client.patch(f"{path}/sections/{plan['sections'][0]['id']}", headers=headers,
                              json={"generation_id": plan["generation_id"], "completed": True})).status_code == 409
    # A stale browser cannot replace the newer plan.
    assert (await client.post(path, headers=headers, json={"replace_generation": plan["generation_id"]})).status_code == 409


@pytest.mark.parametrize("invalid", ["{}", '{"summary":"Plan","sections":[]}', '{"summary":"Plan","sections":[{"title":"Topic"}]}', "```json"])
async def test_invalid_ai_creates_no_plan(client, db_session, user_a, sample_job, invalid):
    path, _ = await make_application(db_session, user_a, sample_job)
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(return_value=invalid)):
        assert (await client.post(path, headers=user_a["headers"], json={})).status_code == 502
    assert (await client.get(path, headers=user_a["headers"])).json() is None


async def test_provider_error_and_unreadable_resume(client, db_session, user_a, sample_job):
    path, _ = await make_application(db_session, user_a, sample_job)
    resume = Resume(user_id=user_a["user"].id, title="Unreadable", file_name="r.pdf", file_path="unused", extracted_text="  ")
    db_session.add(resume)
    await db_session.commit()
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(side_effect=LLMError("No active LLM providers configured"))) as ai:
        assert (await client.post(path, headers=user_a["headers"], json={"resume_id": resume.id})).status_code == 422
        ai.assert_not_called()
        failed = await client.post(path, headers=user_a["headers"], json={"resume_id": None})
        assert failed.status_code == 502
        assert "No active LLM providers" in failed.json()["detail"]
    assert (await client.post(path, headers=user_a["headers"], json={"context": "x" * 3001})).status_code == 422


async def test_application_deletion_removes_preparation(client, db_session, user_a, sample_job):
    path, application = await make_application(db_session, user_a, sample_job)
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(return_value=json.dumps(generated_plan()))):
        plan = (await client.post(path, headers=user_a["headers"], json={})).json()
    await db_session.delete(application)
    await db_session.commit()
    saved_plans = await db_session.scalars(select(InterviewPreparation).where(InterviewPreparation.id == plan["id"]))
    saved_sections = await db_session.scalars(select(InterviewSection).where(InterviewSection.preparation_id == plan["id"]))
    assert saved_plans.one_or_none() is None
    assert not saved_sections.all()


async def test_inflight_generation_cannot_overwrite_newer_plan(client, db_session, user_a, sample_job):
    path, application = await make_application(db_session, user_a, sample_job)
    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(return_value=json.dumps(generated_plan()))):
        plan = (await client.post(path, headers=user_a["headers"], json={})).json()
    newer_generation = str(uuid4())

    async def another_request_finishes_first(**kwargs):
        from sqlalchemy import update
        await db_session.execute(update(InterviewPreparation).where(
            InterviewPreparation.application_id == application.id,
        ).values(generation_id=newer_generation, summary="A newer preparation plan"))
        await db_session.commit()
        return json.dumps(generated_plan())

    with patch("app.api.interview_preparation.LLMManager.generate_with_failover", AsyncMock(side_effect=another_request_finishes_first)):
        stale = await client.post(path, headers=user_a["headers"], json={"replace_generation": plan["generation_id"]})
    assert stale.status_code == 409
    saved = (await client.get(path, headers=user_a["headers"])).json()
    assert saved["generation_id"] == newer_generation
    assert saved["summary"] == "A newer preparation plan"
