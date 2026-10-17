from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest


def external_payload(**overrides):
    return {
        "request_id": str(uuid4()), "role": "Python developer", "company": "Website Co",
        "applied_on": "2026-10-12", "application_method": "Company website",
        **overrides,
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("contact", [{}, {"contact_email": "hr@example.com", "contact_name": "Recruiter", "contact_phone": "+91 1234567890"}, {"contact_name": "Referral contact", "contact_phone": "12345"}])
async def test_record_external_without_dispatch(client, user_a, contact):
    headers = user_a["headers"]
    payload = external_payload(notes="Reference ABC-123", **contact)
    before = (await client.get("/api/dashboard-stats", headers=headers)).json()
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock) as send:
        response = await client.post("/api/applications/external", headers=headers, json=payload)
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["status"] == "applied_externally"
        assert data["applied_on"] == "2026-10-12"
        assert data["application_method"] == "Company website"
        assert data["notes"] == "Reference ABC-123"
        assert data["job"]["contact_email"] == contact.get("contact_email")
        assert data["job"]["contact_name"] == contact.get("contact_name")
        assert data["sent_at"] is data["sent_to"] is data["scheduled_at"] is None
        assert data["resume_id"] is data["cover_letter_id"] is None
        duplicate = await client.post("/api/applications/external", headers=headers, json=payload)
        assert duplicate.status_code == 201
        assert duplicate.json()["id"] == data["id"]
        app_id = data["id"]
        preview = (await client.get(f"/api/applications/{app_id}/preview", headers=headers)).json()
        assert preview["can_send"] is False
        assert "tracking only" in preview["reason_cannot_send"]
        assert (await client.post(f"/api/applications/{app_id}/send", headers=headers)).status_code == 409
        assert (await client.post(f"/api/applications/{app_id}/schedule", headers=headers, json={
            "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        })).status_code == 409
        assert (await client.post("/api/applications", headers=headers, json={"job_id": data["job_id"]})).status_code == 409
        send.assert_not_called()

    listed = (await client.get("/api/applications?status=applied_externally", headers=headers)).json()
    assert any(item["id"] == app_id and item["applied_on"] == payload["applied_on"] for item in listed)
    job = (await client.get(f"/api/jobs/{data['job_id']}", headers=headers)).json()
    assert job["is_applied"] is True
    jobs = (await client.get("/api/jobs", headers=headers)).json()["items"]
    assert next(j for j in jobs if j["id"] == data["job_id"])["is_applied"] is True
    required = (await client.get("/api/hr-contacts/required-jobs", headers=headers)).json()
    assert data["job_id"] not in {job["id"] for job in required}
    after = (await client.get("/api/dashboard-stats", headers=headers)).json()
    assert after["total_applications"] == before["total_applications"] + 1
    assert after["applications_sent"] == before["applications_sent"]
    assert after["hr_contacts_required"] == before["hr_contacts_required"]


@pytest.mark.asyncio
async def test_external_notes_and_privacy(client, user_a, user_b):
    payload = external_payload()
    data = (await client.post("/api/applications/external", headers=user_a["headers"], json=payload)).json()
    app_url = f"/api/applications/{data['id']}"
    assert (await client.get(app_url, headers=user_b["headers"])).status_code == 404
    assert (await client.put(app_url, headers=user_b["headers"], json={"notes": "Other user"})).status_code == 404
    assert (await client.get(f"/api/jobs/{data['job_id']}", headers=user_b["headers"])).status_code == 404
    other_jobs = (await client.get("/api/jobs", headers=user_b["headers"])).json()["items"]
    assert data["job_id"] not in {job["id"] for job in other_jobs}
    notes = await client.put(app_url, headers=user_a["headers"], json={"notes": "Interview next week"})
    assert notes.status_code == 200
    assert notes.json()["notes"] == "Interview next week"
    assert notes.json()["status"] == "applied_externally"
    assert (await client.put(app_url, headers=user_a["headers"], json={"status": "ready"})).status_code == 400
    cleared = await client.put(app_url, headers=user_a["headers"], json={"notes": None})
    assert cleared.json()["notes"] is None
    # The same client request UUID is scoped to each account.
    own = await client.post("/api/applications/external", headers=user_b["headers"], json=payload)
    assert own.status_code == 201
    assert own.json()["id"] != data["id"]


@pytest.mark.asyncio
@pytest.mark.parametrize("overrides", [{"role": "   "}, {"company": ""}, {"application_method": "  "}, {"contact_email": "invalid"}, {"job_url": "javascript:alert(1)"}, {"applied_on": "invalid"}, {"role": "Role\nExtra"}])
async def test_external_validation(client, user_a, overrides):
    response = await client.post("/api/applications/external", headers=user_a["headers"], json=external_payload(**overrides))
    assert response.status_code == 422
