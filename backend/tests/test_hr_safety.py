import pytest


@pytest.mark.asyncio
async def test_hr_contact_safety_flow(client, user_a, sample_job_no_hr):
    # 1. Prepare application for job with no HR email
    prep_resp = await client.post(
        "/api/applications",
        json={"job_id": sample_job_no_hr.id},
        headers=user_a["headers"]
    )
    assert prep_resp.status_code == 201
    app_data = prep_resp.json()
    assert app_data["status"] == "hr_contact_required"
    app_id = app_data["id"]

    # 2. Preview application -> can_send must be False
    preview_resp = await client.get(
        f"/api/applications/{app_id}/preview",
        headers=user_a["headers"]
    )
    assert preview_resp.status_code == 200
    preview_data = preview_resp.json()
    assert preview_data["can_send"] is False
    assert preview_data["has_hr_contact"] is False
    assert "No HR contact" in preview_data["reason_cannot_send"]

    # 3. Attempting to send must strictly fail with 400
    send_resp = await client.post(
        f"/api/applications/{app_id}/send",
        headers=user_a["headers"]
    )
    assert send_resp.status_code == 400
    assert "No HR contact" in send_resp.json()["detail"]

    # 4. Add HR contact for this job
    add_hr_resp = await client.post(
        "/api/hr-contacts",
        json={
            "job_id": sample_job_no_hr.id,
            "contact_name": "Jane Recruiter",
            "email": "jane.recruiter@company.com"
        },
        headers=user_a["headers"]
    )
    assert add_hr_resp.status_code == 201

    # 5. Check application preview now -> can_send is now True (has_hr_contact is True)
    preview_after = await client.get(
        f"/api/applications/{app_id}/preview",
        headers=user_a["headers"]
    )
    assert preview_after.status_code == 200
    preview_after_data = preview_after.json()
    assert preview_after_data["has_hr_contact"] is True
    assert preview_after_data["recipient_email"] == "jane.recruiter@company.com"
