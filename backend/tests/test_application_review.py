from unittest.mock import AsyncMock, patch

import pytest

from app.models.email_settings import EmailSettings
from app.models.resume import Resume


@pytest.mark.asyncio
async def test_reviewed_content_is_previewed_and_sent(client, db_session, user_a, sample_job):
    headers = user_a["headers"]
    draft = await client.post(
        "/api/applications",
        headers=headers,
        json={
            "job_id": sample_job.id,
            "email_subject": "My introduction",
            "cover_letter_content": "Original cover letter",
            "notes": "Private tracking notes",
        },
    )
    assert draft.status_code == 201
    assert draft.json()["cover_letter"]["content"] == "Original cover letter"
    app_id = draft.json()["id"]

    updated = await client.put(
        f"/api/applications/{app_id}",
        headers=headers,
        json={
            "email_subject": "Reviewed subject",
            "cover_letter_content": "Reviewed letter with my own edits.",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["cover_letter"]["content"] == "Reviewed letter with my own edits."
    assert updated.json()["notes"] == "Private tracking notes"

    preview = await client.get(f"/api/applications/{app_id}/preview", headers=headers)
    assert preview.status_code == 200
    assert preview.json()["cover_letter_text"] == "Reviewed letter with my own edits."
    assert preview.json()["email_subject"] == "Reviewed subject"

    db_session.add(EmailSettings(
        user_id=user_a["user"].id,
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="candidate@example.com",
        smtp_password="test-password",
        from_email="candidate@example.com",
        use_tls=True,
    ))
    await db_session.commit()
    with patch(
        "app.services.email_service.EmailService.send_application_email",
        new_callable=AsyncMock,
        return_value=(True, "Sent"),
    ) as send:
        response = await client.post(f"/api/applications/{app_id}/send", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "sent"
    assert send.call_args.kwargs["cover_letter_text"] == "Reviewed letter with my own edits."
    assert send.call_args.kwargs["subject"] == "Reviewed subject"
    assert send.call_args.kwargs["to_email"] == sample_job.contact_email


@pytest.mark.asyncio
async def test_review_can_remove_resume(client, db_session, user_a, sample_job):
    resume = Resume(
        user_id=user_a["user"].id,
        title="Candidate resume",
        file_name="resume.pdf",
        file_path="uploads/resumes/test-review.pdf",
        resume_type="pdf",
        active=True,
    )
    db_session.add(resume)
    await db_session.commit()
    response = await client.post(
        "/api/applications",
        headers=user_a["headers"],
        json={"job_id": sample_job.id, "resume_id": resume.id, "cover_letter_content": "Hello"},
    )
    assert response.status_code == 201
    app_id = response.json()["id"]
    updated = await client.put(
        f"/api/applications/{app_id}",
        headers=user_a["headers"],
        json={"resume_id": None, "cover_letter_content": "Hello without an attachment"},
    )
    assert updated.status_code == 200
    assert updated.json()["resume_id"] is None
    assert updated.json()["resume"] is None


@pytest.mark.asyncio
async def test_review_cannot_edit_another_users_application(client, user_a, user_b, sample_job):
    response = await client.post(
        "/api/applications",
        headers=user_a["headers"],
        json={"job_id": sample_job.id, "cover_letter_content": "User A's letter"},
    )
    assert response.status_code == 201
    app_id = response.json()["id"]
    denied = await client.put(
        f"/api/applications/{app_id}",
        headers=user_b["headers"],
        json={"cover_letter_content": "Unauthorized edit"},
    )
    assert denied.status_code == 404
    unchanged = await client.get(f"/api/applications/{app_id}", headers=user_a["headers"])
    assert unchanged.json()["cover_letter"]["content"] == "User A's letter"
