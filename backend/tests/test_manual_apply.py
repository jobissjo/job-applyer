from uuid import uuid4
from unittest.mock import AsyncMock, patch

import pytest
from app.models.email_settings import EmailSettings
from app.models.resume import Resume


@pytest.fixture
def manual_payload():
    return {
        "request_id": str(uuid4()),
        "role": "Backend Engineer",
        "email": "recruiter@example.com",
        "description": "Build Python APIs with FastAPI. Experience with SQL and async services required.",
        "company": "Example Company",
    }


@pytest.mark.asyncio
async def test_manual_job_can_be_prepared_sent_and_followed_up(client, db_session, user_a, manual_payload):
    headers = user_a["headers"]
    created = await client.post("/api/jobs/manual", json=manual_payload, headers=headers)
    assert created.status_code == 201
    job = created.json()
    assert job["title"] == manual_payload["role"]
    assert job["description"] == manual_payload["description"]
    assert job["contact_email"] == manual_payload["email"]
    assert job["has_hr_contact"] is True
    assert job["source"] == "manual"
    assert job["job_url"] == ""

    resume = Resume(
        user_id=user_a["user"].id, title="Backend resume",
        file_name="resume.pdf", file_path="uploads/resumes/test-manual.pdf",
        resume_type="pdf", active=True,
    )
    db_session.add(resume)
    db_session.add(EmailSettings(
        user_id=user_a["user"].id, smtp_host="smtp.example.com", smtp_port=587,
        smtp_username="candidate@example.com", smtp_password="test-password",
        from_email="candidate@example.com", use_tls=True,
    ))
    await db_session.commit()
    with patch("app.services.application_service.LLMManager.generate_with_failover", new_callable=AsyncMock, return_value="My tailored introduction") as llm:
        generated = await client.post(
            f"/api/jobs/{job['id']}/generate-cover-letter",
            json={"job_id": job["id"], "resume_id": resume.id}, headers=headers,
        )
    assert generated.status_code == 200
    assert manual_payload["description"] in llm.call_args.kwargs["prompt"]
    assert manual_payload["role"] in llm.call_args.kwargs["prompt"]

    prepared = await client.post(
        "/api/applications", headers=headers,
        json={
            "job_id": job["id"], "resume_id": resume.id,
            "cover_letter_content": generated.json()["content"],
            "email_subject": "Application for Backend Engineer",
        },
    )
    assert prepared.status_code == 201
    assert prepared.json()["status"] == "ready"
    app_id = prepared.json()["id"]
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock, return_value=(True, "Sent")) as send:
        response = await client.post(f"/api/applications/{app_id}/send", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "sent"
    assert send.call_args.kwargs["to_email"] == manual_payload["email"]
    assert send.call_args.kwargs["cover_letter_text"] == "My tailored introduction"
    assert send.call_args.kwargs["resume_path"] == resume.file_path
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock, return_value=(True, "Sent")) as send:
        follow_up = await client.post(
            f"/api/applications/{app_id}/follow-ups",
            json={"request_id": str(uuid4()), "subject": "Follow-up", "body": "Is there an update?"},
            headers=headers,
        )
    assert follow_up.status_code == 200
    assert follow_up.json()["status"] == "sent"
    assert send.call_args.kwargs["to_email"] == manual_payload["email"]


@pytest.mark.asyncio
async def test_manual_jobs_are_private_and_retries_do_not_duplicate(client, user_a, user_b, manual_payload):
    created = await client.post("/api/jobs/manual", json=manual_payload, headers=user_a["headers"])
    assert created.status_code == 201
    job_id = created.json()["id"]
    repeat = await client.post("/api/jobs/manual", json=manual_payload, headers=user_a["headers"])
    assert repeat.status_code == 201
    assert repeat.json()["id"] == job_id
    own_list = await client.get("/api/jobs?source=manual", headers=user_a["headers"])
    assert own_list.json()["total"] == 1
    other_list = await client.get("/api/jobs?source=manual", headers=user_b["headers"])
    assert other_list.json()["total"] == 0
    assert (await client.get(f"/api/jobs/{job_id}", headers=user_b["headers"])).status_code == 404
    assert (await client.delete(f"/api/jobs/{job_id}", headers=user_b["headers"])).status_code == 404
    assert (await client.post("/api/applications", json={"job_id": job_id, "cover_letter_content": "Unauthorized"}, headers=user_b["headers"])).status_code == 404
    assert (await client.post("/api/applications", json={"job_id": job_id}, headers=user_b["headers"])).status_code == 404
    assert (await client.post(f"/api/jobs/{job_id}/analyze", headers=user_b["headers"])).status_code == 404
    assert (await client.post(f"/api/jobs/{job_id}/generate-cover-letter", json={"job_id": job_id}, headers=user_b["headers"])).status_code == 404
    assert (await client.post("/api/hr-contacts", json={"job_id": job_id, "email": "other@example.com"}, headers=user_b["headers"])).status_code == 404
    assert (await client.get(f"/api/jobs/{job_id}", headers=user_a["headers"])).status_code == 200


@pytest.mark.asyncio
async def test_manual_job_optional_details(client, user_a, manual_payload):
    payload = {**manual_payload, "company": None, "job_url": "https://example.com/careers/engineer"}
    created = await client.post("/api/jobs/manual", json=payload, headers=user_a["headers"])
    assert created.status_code == 201
    assert created.json()["company"] == "Company not specified"
    assert created.json()["job_url"] == payload["job_url"]


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [
    {"role": "  "},
    {"role": "Engineer\nBcc: injected@example.com"},
    {"email": "not-an-email"},
    {"description": "\n  "},
    {"job_url": "javascript:alert(1)"},
])
async def test_manual_job_validates_inputs(client, user_a, manual_payload, changes):
    response = await client.post("/api/jobs/manual", json={**manual_payload, **changes}, headers=user_a["headers"])
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_manual_application_cannot_link_another_users_cover_letter(client, user_a, user_b, manual_payload):
    owner_job = await client.post("/api/jobs/manual", json=manual_payload, headers=user_a["headers"])
    owner_app = await client.post(
        "/api/applications", headers=user_a["headers"],
        json={"job_id": owner_job.json()["id"], "cover_letter_content": "Private application letter"},
    )
    assert owner_app.status_code == 201
    letter_id = owner_app.json()["cover_letter_id"]

    other_job = await client.post(
        "/api/jobs/manual", json={**manual_payload, "request_id": str(uuid4())},
        headers=user_b["headers"],
    )
    job_id = other_job.json()["id"]
    denied = await client.post(
        "/api/applications", headers=user_b["headers"],
        json={"job_id": job_id, "cover_letter_id": letter_id},
    )
    assert denied.status_code == 404
    other_app = await client.post(
        "/api/applications", headers=user_b["headers"],
        json={"job_id": job_id, "cover_letter_content": "My introduction"},
    )
    assert other_app.status_code == 201
    denied = await client.put(
        f"/api/applications/{other_app.json()['id']}", headers=user_b["headers"],
        json={"cover_letter_id": letter_id},
    )
    assert denied.status_code == 404
