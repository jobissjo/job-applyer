import json
from unittest.mock import AsyncMock, patch
import pytest
from app.models.manual_job import ManualJobOwnership
from app.models.resume import Resume
from app.models.job import Job

pytestmark = pytest.mark.asyncio


async def test_deduplicates_and_preserves_progress(client, user_a, sample_job, sample_job_no_hr):
    headers = user_a["headers"]
    first = await client.post('/api/learning', headers=headers, json={"skill": " Docker ", "job_ids": [sample_job.id]})
    assert first.status_code == 200, first.text
    item = first.json()
    await client.patch(f'/api/learning/{item["id"]}', headers=headers, json={"status": "in_progress"})
    await client.post(f'/api/learning/{item["id"]}/entries', headers=headers, json={"kind": "note", "content": "Build an image"})
    second = await client.post('/api/learning', headers=headers, json={"skill": "DOCKER", "job_ids": [sample_job_no_hr.id, sample_job.id]})
    assert second.status_code == 200, second.text
    result = second.json()
    assert result['id'] == item['id']
    assert result['status'] == 'in_progress'
    assert len(result['jobs']) == 2
    assert len(result['entries']) == 1
    assert (await client.delete(f'/api/learning/{item["id"]}/jobs/{sample_job.id}', headers=headers)).status_code == 204
    saved = (await client.get('/api/learning', headers=headers)).json()
    assert len(next(row for row in saved if row['id'] == item['id'])['jobs']) == 1


async def test_entries_lifecycle_and_validation(client, user_a):
    headers = user_a['headers']
    item = (await client.post('/api/learning', headers=headers, json={"skill": "SQL"})).json()
    path = f'/api/learning/{item["id"]}/entries'
    for payload in [
        {"kind": "resource", "content": "Course", "url": "javascript:alert(1)"},
        {"kind": "resource", "content": "Course"},
        {"kind": "note", "content": "   "},
    ]:
        assert (await client.post(path, headers=headers, json=payload)).status_code == 422
    for payload in [{"kind": "note", "content": "Practice joins"}, {"kind": "resource", "content": "Docs", "url": "https://example.com/sql"}]:
        response = await client.post(path, headers=headers, json=payload)
        assert response.status_code == 200, response.text
    entries = response.json()['entries']
    assert len(entries) == 2
    changed = await client.put(f'{path}/{entries[0]["id"]}', headers=headers, json={"kind": "note", "content": "Practiced joins"})
    assert changed.json()['entries'][0]['content'] == 'Practiced joins'
    assert (await client.delete(f'{path}/{entries[0]["id"]}', headers=headers)).status_code == 204
    assert (await client.delete(f'/api/learning/{item["id"]}', headers=headers)).status_code == 204
    assert (await client.patch(f'/api/learning/{item["id"]}', headers=headers, json={"status": "completed"})).status_code == 404
    assert (await client.post('/api/learning', headers=headers, json={"skill": "   "})).status_code == 422


async def test_account_isolation(client, user_a, user_b, sample_job):
    item = (await client.post('/api/learning', headers=user_a['headers'], json={"skill": "Private skill", "job_ids": [sample_job.id]})).json()
    path = f'/api/learning/{item["id"]}'
    for method, url, payload in [
        ('patch', path, {"status": "completed"}), ('delete', path, None),
        ('post', path + '/entries', {"kind": "note", "content": "Intrusion"}),
        ('delete', path + f'/jobs/{sample_job.id}', None),
        ('put', path + '/entries/1', {"kind": "note", "content": "Intrusion"}),
        ('delete', path + '/entries/1', None),
    ]:
        result = await client.request(method, url, headers=user_b['headers'], **({'json': payload} if payload else {}))
        assert result.status_code == 404
    assert all(row['id'] != item['id'] for row in (await client.get('/api/learning', headers=user_b['headers'])).json())
    own = (await client.post('/api/learning', headers=user_b['headers'], json={"skill": "Private skill"})).json()
    assert own['id'] != item['id']


async def test_private_job_and_resume_access(client, db_session, user_a, user_b, sample_job):
    private = Job(source="manual", source_job_id=f'private-learning-{user_b["user"].id}', title="Private", company="Hidden", job_url="")
    db_session.add(private)
    await db_session.flush()
    db_session.add(ManualJobOwnership(job_id=private.id, user_id=user_b['user'].id))
    resume = Resume(user_id=user_b['user'].id, title="Secret resume", file_name="r.pdf", file_path="unused", extracted_text="Python")
    db_session.add(resume)
    await db_session.commit()
    assert (await client.post('/api/learning', headers=user_a['headers'], json={"skill": "Secret", "job_ids": [private.id]})).status_code == 404
    assert (await client.post(f'/api/learning/jobs/{private.id}/gaps', headers=user_a['headers'], json={"resume_id": resume.id})).status_code == 404
    assert (await client.post(f'/api/learning/jobs/{sample_job.id}/gaps', headers=user_a['headers'], json={"resume_id": resume.id})).status_code == 404


async def test_gap_comparison(client, db_session, user_a, sample_job):
    resume = Resume(user_id=user_a['user'].id, title="My resume", file_name="r.pdf", file_path="unused", extracted_text="Python and SQL experience")
    db_session.add(resume)
    await db_session.commit()
    path = f'/api/learning/jobs/{sample_job.id}/gaps'
    mock = AsyncMock(return_value=json.dumps({"skills": [{"skill": "FastAPI", "reason": "Job requests FastAPI; no evidence in the resume or profile."}]}))
    with patch('app.api.learning.LLMManager.generate_with_failover', mock):
        response = await client.post(path, headers=user_a['headers'], json={"resume_id": resume.id})
    assert response.status_code == 200, response.text
    assert response.json()['skills'][0]['skill'] == 'FastAPI'
    assert 'Python and SQL experience' in mock.call_args.kwargs['prompt']
    assert sample_job.description in mock.call_args.kwargs['prompt']
    with patch('app.api.learning.LLMManager.generate_with_failover', AsyncMock(return_value='{"skills": "bad"}')):
        assert (await client.post(path, headers=user_a['headers'], json={"resume_id": resume.id})).status_code == 502
    resume.extracted_text = ''
    await db_session.commit()
    assert (await client.post(path, headers=user_a['headers'], json={"resume_id": resume.id})).status_code == 422
