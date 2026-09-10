import io
import pytest


@pytest.mark.asyncio
async def test_resume_upload_and_mapping(client, user_a):
    # 1. Create a job title first
    title_resp = await client.post(
        "/api/job-titles",
        json={"title": "FastAPI Developer", "active": True},
        headers=user_a["headers"]
    )
    assert title_resp.status_code == 201
    title_id = title_resp.json()["id"]

    # 2. Upload dummy text resume (simulating file)
    file_content = b"John Doe\nExperienced Python and FastAPI Developer with 4 years in software engineering."
    files = {
        "file": ("test_resume.pdf", io.BytesIO(file_content), "application/pdf")
    }
    data = {
        "title": "FastAPI Resume",
        "job_title_ids": str(title_id)
    }

    upload_resp = await client.post(
        "/api/resumes",
        data=data,
        files=files,
        headers=user_a["headers"]
    )
    assert upload_resp.status_code == 201
    resume_data = upload_resp.json()
    assert resume_data["title"] == "FastAPI Resume"
    assert resume_data["file_name"] == "test_resume.pdf"
    assert len(resume_data["mapped_job_titles"]) == 1
    assert resume_data["mapped_job_titles"][0]["id"] == title_id
    resume_id = resume_data["id"]

    # 3. List resumes
    list_resp = await client.get("/api/resumes", headers=user_a["headers"])
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # 4. Download resume
    dl_resp = await client.get(f"/api/resumes/{resume_id}/download", headers=user_a["headers"])
    assert dl_resp.status_code == 200
