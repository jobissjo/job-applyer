# Interview tracking

Open an application with delivery status **Sent** or **Applied elsewhere**. The
**Interviews & outcomes** panel records hiring progress separately from email
delivery status. Selecting an outcome does not send an email or accept an offer.

1. Choose a hiring progress value and press **Update progress**. Callback received,
   Interviewing, Selected, Not selected, and Withdrawn appear in the tracker.
2. Add an interview round. A name is required; a date/time is required only when
   its status is Scheduled. Dates use the device/browser timezone and are saved
   in UTC. Historical appointments can also be recorded.
3. Record preparation notes, how the interview went, what went wrong, feedback
   received, and what to improve next time. All fields are optional and private.
4. Use **Edit / reschedule** to update a round. Mark it Completed, Missed, or
   Cancelled as appropriate. Only completed rounds accept Passed or Not passed
   results. Awaiting result is the default.
5. Update the overall hiring progress when a recruiter confirms the outcome.
   A failed round does not automatically reject the application. Selected and
   Not selected can be recorded without any rounds.

Adding a round starts Interviewing for applications previously Awaiting response
or Callback received. It preserves an existing Selected, Not selected, or
Withdrawn outcome. Correct the overall progress explicitly when reopening one.

Past scheduled appointments display **Needs update**; time passing never marks
an interview missed automatically. The upcoming filter uses scheduled rounds in
the future; awaiting results uses completed rounds with no result recorded.

The web sidebar links to **Interviews & outcomes**. Mobile has links in Applications
and More, with a dedicated detail screen for tracking and preparation. The original
application remains available. Search/filter controls operate on the same saved
records, including private applications submitted elsewhere.

Change history saves previous and new round values, including rescheduled times
and edited notes. Resetting hiring progress to Awaiting response retains that
history and keeps the application reachable from the tracker. Cancel a round to
retain its record; the first version does not include round deletion.

## Database and API

Run `python -m alembic upgrade head` from `backend` using the project's Python
environment, then restart the API. Revision `c68fd5a47216` adds
`applications.hiring_progress`, `interview_rounds`, and `interview_changes`.
Existing applications default to Awaiting response, preserving delivery status,
notes, attachments, and follow-ups. The migration supports SQLite and PostgreSQL.

All endpoints require authentication and application ownership. Tracking changes
are accepted only for sent or externally submitted applications.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/interviews` | List tracked applications, rounds, and history |
| GET | `/api/applications/{id}/interviews` | Read tracking details |
| PATCH | `/api/applications/{id}/hiring-progress` | Set hiring progress |
| POST | `/api/applications/{id}/interviews` | Add a round |
| PUT | `/api/applications/{id}/interviews/{round_id}` | Replace editable round fields |

Mutations save history in the same transaction. PostgreSQL serializes tracking
mutations for each application using a row lock. The listing batches application,
round, and history queries to avoid a query per tracked record.

The first version uses manual updates. Calendar integrations, inbox detection,
notifications, and changes to scheduled email/follow-up behavior are outside its
scope. Interview preparation continues to use the existing AI provider setup;
manual tracking requires no AI or SMTP configuration.
