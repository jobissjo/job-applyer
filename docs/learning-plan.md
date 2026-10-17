# Learning tracker

## Workflow

On a job or application screen, select a resume and use **Find skill gaps**.
The configured AI compares explicit job requirements with extracted resume text
and profile additional details. Review the suggestions before adding them to Learning.
Manual skill entry is available without an AI provider.

One account has one learning item per normalized skill name (Unicode normalization,
case folding, trimmed and collapsed whitespace). Saving the same name for another
job adds a link and preserves existing progress, notes, and resources. Distinct
aliases such as JS and JavaScript are not automatically merged; AI is asked to use
canonical names. Items may also exist without a job.

Learning supports Planned, In progress, Completed, and On hold; multiple editable
notes and HTTP(S) resources; job linking and unlinking; search and status filtering;
and deletion. Completing a skill does not modify resumes or profile claims.

## Storage and access

- `learning_items`: account, display skill, unique normalized skill, status, timestamps.
- `learning_jobs`: unique pair of learning item and job.
- `learning_entries`: note or resource, content, optional URL, timestamps.

All operations verify account ownership. Job linking and AI comparison verify job
visibility; resume comparison verifies resume ownership and usable extracted text.
Conflict-safe inserts prevent duplicate items and job links. Foreign keys cascade
child cleanup. AI failures do not block application preparation or sending.

## Validation

Cover duplicate skills across jobs, progress preservation, note/resource lifecycle,
account isolation, inaccessible manual jobs and resumes, invalid inputs, and AI
comparison inputs/output. Run the backend suite and frontend production build.

## Setup

Run `python -m alembic upgrade head` from `backend` and restart the API. The existing
startup table creation also creates the new tables. AI suggestions require an active
AI provider; adding and managing learning manually does not.
