from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, patch

import pytest
from app.models.application import Application


async def external(client, user):
    response = await client.post('/api/applications/external', headers=user['headers'], json={
        'request_id': str(uuid4()), 'role': 'Engineer', 'company': 'Interview Co',
        'applied_on': '2026-10-01', 'application_method': 'Company website',
    })
    assert response.status_code == 201, response.text
    return response.json()['id']


@pytest.mark.asyncio
async def test_progress_and_direct_outcomes_preserve_delivery(client, user_a):
    app_id = await external(client, user_a)
    headers = user_a['headers']
    assert (await client.get('/api/interviews', headers=headers)).json() == []
    with patch('app.services.email_service.EmailService.send_application_email', new_callable=AsyncMock) as send:
        for progress in ['callback_received', 'selected', 'not_selected', 'withdrawn', 'awaiting_response']:
            response = await client.patch(f'/api/applications/{app_id}/hiring-progress', headers=headers, json={'progress': progress})
            assert response.status_code == 200, response.text
            data = response.json()
            assert data['application']['hiring_progress'] == progress
            assert data['application']['status'] == 'applied_externally'
            assert data['application']['sent_at'] is None
            assert not data['rounds']
        send.assert_not_called()
    assert len(data['history']) == 5
    repeated = (await client.patch(f'/api/applications/{app_id}/hiring-progress', headers=headers, json={'progress': 'awaiting_response'})).json()
    assert len(repeated['history']) == 5
    # Reset records retain their history and stay reachable from the tracker.
    assert (await client.get('/api/interviews', headers=headers)).json()[0]['application']['id'] == app_id
    assert (await client.get(f'/api/applications/{app_id}', headers=headers)).json()['hiring_progress'] == 'awaiting_response'


@pytest.mark.asyncio
async def test_multiple_rounds_reflections_reschedule_and_history(client, user_a):
    app_id = await external(client, user_a)
    headers = user_a['headers']
    url = f'/api/applications/{app_id}/interviews'
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    first = await client.post(url, headers=headers, json={'name': 'HR screening', 'status': 'scheduled', 'scheduled_at': past})
    assert first.status_code == 201, first.text
    data = first.json()
    assert data['application']['hiring_progress'] == 'interviewing'
    # The backend never assumes that a past appointment was missed.
    assert data['rounds'][0]['status'] == 'scheduled'
    round_id = data['rounds'][0]['id']
    update = {'name': 'HR screening', 'status': 'completed', 'result': 'passed', 'scheduled_at': past,
              'reflection': 'Good explanation of experience', 'went_wrong': 'Could not explain indexing',
              'feedback': 'Practice SQL', 'improvements': 'Use examples', 'preparation_notes': 'Review resume'}
    response = await client.put(f'{url}/{round_id}', headers=headers, json=update)
    assert response.status_code == 200, response.text
    completed = response.json()['rounds'][0]
    for key in ['reflection', 'went_wrong', 'feedback', 'improvements', 'preparation_notes']:
        assert completed[key] == update[key]
    future = (datetime.now(timezone.utc) + timedelta(days=1)).astimezone(timezone(timedelta(hours=5, minutes=30))).isoformat()
    second = await client.post(url, headers=headers, json={'name': 'Technical', 'status': 'scheduled', 'scheduled_at': future})
    second_id = second.json()['rounds'][1]['id']
    rescheduled = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    moved = await client.put(f'{url}/{second_id}', headers=headers, json={'name': 'Technical', 'status': 'scheduled', 'scheduled_at': rescheduled})
    assert moved.status_code == 200, moved.text
    change = moved.json()['history'][0]
    assert change['before']['scheduled_at'] != change['after']['scheduled_at']
    assert change['after']['scheduled_at'].endswith('Z')
    # Mark missed, then cancelled; notes remain editable for either state.
    for status in ['missed', 'cancelled']:
        response = await client.put(f'{url}/{second_id}', headers=headers, json={
            'name': 'Technical', 'status': status, 'went_wrong': 'Connection failed', 'improvements': 'Test connection',
        })
        assert response.status_code == 200, response.text
        assert response.json()['rounds'][1]['went_wrong'] == 'Connection failed'
    saved = (await client.get(url, headers=headers)).json()
    assert len(saved['rounds']) == 2
    assert saved['rounds'][0]['feedback'] == 'Practice SQL'


@pytest.mark.asyncio
async def test_tracking_ownership_including_cross_application_rounds(client, user_a, user_b):
    app_id = await external(client, user_a)
    other_id = await external(client, user_b)
    url = f'/api/applications/{app_id}/interviews'
    created = (await client.post(url, headers=user_a['headers'], json={'name': 'Technical'})).json()
    round_id = created['rounds'][0]['id']
    for method, path, payload in [
        ('get', url, None), ('post', url, {'name': 'Other'}),
        ('put', f'{url}/{round_id}', {'name': 'Other'}),
        ('patch', f'/api/applications/{app_id}/hiring-progress', {'progress': 'selected'}),
    ]:
        kwargs = {'headers': user_b['headers']}
        if payload is not None:
            kwargs['json'] = payload
        assert (await getattr(client, method)(path, **kwargs)).status_code == 404
    assert (await client.put(f'/api/applications/{other_id}/interviews/{round_id}', headers=user_b['headers'], json={'name': 'Other'})).status_code == 404
    assert (await client.get('/api/interviews', headers=user_b['headers'])).json() == []
    assert (await client.get(url)).status_code in (401, 403)


@pytest.mark.asyncio
@pytest.mark.parametrize('payload', [
    {'name': '   '}, {'name': 'x', 'status': 'unknown'}, {'name': 'x', 'result': 'passed'},
    {'name': 'x', 'status': 'scheduled'}, {'name': 'x', 'scheduled_at': '2026-10-25T12:00:00'},
    {'name': 'x', 'went_wrong': 'x' * 50001}, {'name': 'x', 'mode': 'invalid'},
])
async def test_round_validation(client, user_a, payload):
    app_id = await external(client, user_a)
    response = await client.post(f'/api/applications/{app_id}/interviews', headers=user_a['headers'], json=payload)
    assert response.status_code == 422, response.text
    assert (await client.get(f'/api/applications/{app_id}/interviews', headers=user_a['headers'])).json()['rounds'] == []


@pytest.mark.asyncio
@pytest.mark.parametrize('status', ['draft', 'ready', 'scheduled', 'sending', 'failed', 'sent'])
async def test_only_submitted_applications_can_be_tracked(client, user_a, sample_job, db_session, status):
    app = Application(user_id=user_a['user'].id, job_id=sample_job.id, status=status,
                      sent_to='hr@example.com' if status == 'sent' else None)
    db_session.add(app)
    await db_session.commit()
    response = await client.patch(f'/api/applications/{app.id}/hiring-progress', headers=user_a['headers'], json={'progress': 'selected'})
    assert response.status_code == (200 if status == 'sent' else 409), response.text
    if status == 'sent':
        assert response.json()['application']['status'] == 'sent'
        assert response.json()['application']['sent_to'] == 'hr@example.com'
        listed = (await client.get('/api/applications?status=sent', headers=user_a['headers'])).json()
        assert next(a for a in listed if a['id'] == app.id)['hiring_progress'] == 'selected'
    invalid = await client.patch(f'/api/applications/{app.id}/hiring-progress', headers=user_a['headers'], json={'progress': 'unknown'})
    assert invalid.status_code == 422


def test_upgrade_existing_applications_and_downgrade(tmp_path):
    from pathlib import Path
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, text, inspect

    backend = Path(__file__).resolve().parents[1]
    engine = create_engine(f"sqlite:///{tmp_path / 'interview_migration.db'}")
    config = Config(str(backend / 'alembic.ini'))
    config.set_main_option('script_location', str(backend / 'alembic'))
    with engine.connect() as connection:
        config.attributes['connection'] = connection
        command.upgrade(config, 'b57ec4f36105')
        stamp = datetime.now(timezone.utc).isoformat()
        connection.execute(text('INSERT INTO users (id, email, hashed_password, is_active, created_at, updated_at) VALUES (1, :email, :password, true, :stamp, :stamp)'), {'email': 'migration@example.com', 'password': 'unused', 'stamp': stamp})
        connection.execute(text("INSERT INTO jobs (id, source, source_job_id, title, company, job_url, scraped_at, created_at, updated_at) VALUES (1, 'test', 'migration', 'Engineer', 'Company', '', :stamp, :stamp, :stamp)"), {'stamp': stamp})
        connection.execute(text("INSERT INTO applications (id, user_id, job_id, status, notes, sent_to, created_at, updated_at) VALUES (1, 1, 1, 'sent', 'Existing notes', 'hr@example.com', :stamp, :stamp)"), {'stamp': stamp})
        connection.commit()
        command.upgrade(config, 'head')
        row = connection.execute(text('SELECT status, notes, sent_to, hiring_progress FROM applications WHERE id=1')).one()
        assert tuple(row) == ('sent', 'Existing notes', 'hr@example.com', 'awaiting_response')
        assert {'interview_rounds', 'interview_changes'} <= set(inspect(connection).get_table_names())
        command.downgrade(config, 'b57ec4f36105')
        assert 'hiring_progress' not in {c['name'] for c in inspect(connection).get_columns('applications')}
        assert connection.execute(text('SELECT notes FROM applications WHERE id=1')).scalar_one() == 'Existing notes'
        command.upgrade(config, 'head')
    engine.dispose()
