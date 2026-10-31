"""Security regressions and explicit compatibility with existing users/sessions."""
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import jwt
import pytest
from sqlalchemy import select
from app.config import settings
from app.models.application import Application
from app.models.job import Job
from app.models.job_title import JobTitlePreference
from app.models.resume import Resume
from app.models.resume_job_title import ResumeJobTitle
from app.models.security import LoginAttempt
from app.services.job_access import get_accessible_job
from app.utils.security import hash_password, create_access_token


@pytest.mark.asyncio
async def test_shared_job_removal_preserves_records_for_other_users(client, db_session, user_a, user_b, sample_job):
    applications = [Application(user_id=u["user"].id, job_id=sample_job.id, status="draft") for u in (user_a, user_b)]
    db_session.add_all(applications)
    await db_session.commit()
    job_id = sample_job.id
    response = await client.delete(f"/api/jobs/{job_id}", headers=user_a["headers"])
    assert response.status_code == 204
    assert await db_session.get(Job, job_id) is not None
    for application in applications:
        saved = (await db_session.execute(select(Application).where(Application.id == application.id))).scalar_one()
        assert saved.id == application.id
    assert (await client.get(f"/api/jobs/{job_id}", headers=user_a["headers"])).status_code == 404
    assert (await client.get(f"/api/jobs/{job_id}", headers=user_b["headers"])).status_code == 200
    a_list = (await client.get("/api/jobs", headers=user_a["headers"])).json()
    b_list = (await client.get("/api/jobs", headers=user_b["headers"])).json()
    assert job_id not in [j["id"] for j in a_list["items"]]
    assert job_id in [j["id"] for j in b_list["items"]]
    own_application = await client.get(f"/api/applications/{applications[0].id}", headers=user_a["headers"])
    assert own_application.status_code == 200
    # Service operations on already-saved applications remain authorized.
    assert (await get_accessible_job(job_id, user_a["user"].id, db_session)).id == job_id


@pytest.mark.asyncio
async def test_foreign_resume_mapping_rejected_atomically(client, db_session, user_a, user_b):
    own = JobTitlePreference(user_id=user_a["user"].id, title="Own title")
    foreign = JobTitlePreference(user_id=user_b["user"].id, title="Private title")
    resume = Resume(user_id=user_a["user"].id, title="Original", file_name="test.pdf", file_path="unused-test.pdf")
    db_session.add_all([own, foreign, resume])
    await db_session.flush()
    db_session.add(ResumeJobTitle(resume_id=resume.id, job_title_id=own.id))
    await db_session.commit()
    result = await client.put(f"/api/resumes/{resume.id}", headers=user_a["headers"], json={
        "title": "Should not save", "job_title_ids": [own.id, foreign.id]})
    assert result.status_code == 404
    saved = (await client.get(f"/api/resumes/{resume.id}", headers=user_a["headers"])).json()
    assert saved["title"] == "Original"
    assert [t["id"] for t in saved["mapped_job_titles"]] == [own.id]
    uploaded = await client.post("/api/resumes", headers=user_a["headers"],
        data={"title": "Blocked", "job_title_ids": str(foreign.id)},
        files={"file": ("test.pdf", b"test", "application/pdf")})
    assert uploaded.status_code == 404
    # Duplicates from an existing client are harmless and preserve API usability.
    valid = await client.put(f"/api/resumes/{resume.id}", headers=user_a["headers"], json={"job_title_ids": [own.id, own.id]})
    assert valid.status_code == 200
    assert len(valid.json()["mapped_job_titles"]) == 1


@pytest.mark.asyncio
async def test_preexisting_foreign_mapping_is_not_disclosed(client, db_session, user_a, user_b):
    foreign = JobTitlePreference(user_id=user_b["user"].id, title="Secret")
    resume = Resume(user_id=user_a["user"].id, title="Legacy", file_name="test.pdf", file_path="unused-test.pdf")
    db_session.add_all([foreign, resume])
    await db_session.flush()
    db_session.add(ResumeJobTitle(resume_id=resume.id, job_title_id=foreign.id))
    await db_session.commit()
    assert (await client.get(f"/api/resumes/{resume.id}", headers=user_a["headers"])).json()["mapped_job_titles"] == []
    listed = (await client.get("/api/resumes", headers=user_a["headers"])).json()
    assert next(r for r in listed if r["id"] == resume.id)["mapped_job_titles"] == []


@pytest.mark.asyncio
async def test_legacy_password_and_tokens_remain_valid_logout_is_scoped(client, db_session, user_a):
    # Existing short passwords are not invalidated by the new registration policy.
    user_a["user"].hashed_password = hash_password("old")
    await db_session.commit()
    response = await client.post("/api/auth/login", json={"email": user_a["user"].email, "password": "old"})
    assert response.status_code == 200
    # Legacy tokens have sub/exp only and continue to work until explicitly revoked.
    old_token = jwt.encode({"sub": str(user_a["user"].id), "exp": datetime.now(timezone.utc) + timedelta(days=1)},
                           settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    old_headers = {"Authorization": f"Bearer {old_token}"}
    assert (await client.get("/api/auth/me", headers=old_headers)).status_code == 200
    assert (await client.post("/api/auth/logout", headers=old_headers)).status_code == 204
    assert (await client.get("/api/auth/me", headers=old_headers)).status_code == 401
    other_session = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert (await client.get("/api/auth/me", headers=other_session)).status_code == 200
    assert create_access_token({"sub": "1"}) != create_access_token({"sub": "1"})


@pytest.mark.asyncio
async def test_login_attempt_limit_and_recovery(client, db_session, user_a, user_b):
    payload = {"email": user_a["user"].email, "password": "bad"}
    from app.services.login_throttle import MAX_ATTEMPTS, WINDOW_SECONDS
    with patch("app.api.auth.verify_password", return_value=False):
        for _ in range(MAX_ATTEMPTS):
            assert (await client.post("/api/auth/login", json=payload)).status_code == 401
    limited = await client.post("/api/auth/login", json=payload)
    assert limited.status_code == 429
    assert 0 < int(limited.headers["Retry-After"]) <= WINDOW_SECONDS
    # Another user's normal login is unaffected by this user's failed guesses.
    other = await client.post("/api/auth/login", json={"email": user_b["user"].email, "password": "Password123!"})
    assert other.status_code == 200
    with patch("app.services.login_throttle.time.time", return_value=time.time() + WINDOW_SECONDS):
        recovered = await client.post("/api/auth/login", json={**payload, "password": "Password123!"})
    assert recovered.status_code == 200
    # Successful login clears its counter; regular use never builds toward a lockout.
    assert not (await db_session.scalars(select(LoginAttempt))).all()


@pytest.mark.asyncio
@pytest.mark.parametrize("password", ["", "short", "a" * 73, "😀" * 19])
async def test_new_accounts_reject_invalid_passwords(client, password):
    response = await client.post("/api/auth/register", json={"email": "new-policy@example.com", "password": password})
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("subject", ["not-an-id", "0", "9" * 100, "-1", "１２３"])
async def test_invalid_token_subject_is_401_not_server_error(client, subject):
    token = jwt.encode({"sub": subject, "exp": datetime.now(timezone.utc) + timedelta(minutes=1)},
                       settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
