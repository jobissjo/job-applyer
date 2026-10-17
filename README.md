# JobApply — Your next chapter

A developer-friendly job discovery and application assistant built with **FastAPI**, **React + TypeScript**, **PostgreSQL / local SQLite + SQLAlchemy 2.0 (`Mapped` / `mapped_column`)**, **Alembic**, and multi-provider **LLM Failover** (OpenRouter, Groq, Gemini, xKiro).

Designed strictly for personal use on your local workstation. No Docker required, no microservices, no cloud vendor lock-in, and zero unsolicited automated email spam.

---

## Interface & workflows

The light workspace groups navigation into Workspace, Your toolkit, and Settings. The overview shows actual saved setup progress, recent applications, and the next actions to take. Navigation is available on mobile through the menu button.

- **Manual apply for a job found elsewhere:** Open Manual apply, enter the role, recruiter email, and job description, and optionally add a company or listing link. Continue to choose a resume and write a cover letter, then review and send. These entries are private to your account.
- **Manual application:** Find jobs → open an opportunity → analyze your fit → choose a resume and prepare a cover letter → review application → send. Sending saves the latest message and attachment selection first.
- **Auto Apply:** Choose a source and search keyword, acknowledge that the run can send emails and create a resume from your profile, and start the run. The results show each application's actual status.
- **Follow-ups:** Sent applications have a Follow up action in the list and detail page. Review and edit the suggested message, optionally reattach the resume, and send it to the original recruiter. Sent and failed attempts are stored separately from the original application.
- **Application tracking:** Filter by ready, sent, contact needed, draft, or failed. Dashboard links open the corresponding filter directly.
- **Already applied elsewhere:** In Applications, click **Add already applied** to record a role submitted through a company website, job portal, referral, email, or another method. Enter the role, company, date, and how you applied. HR contact details, listing link, description, and tracking notes are optional. These private records appear under **Applied elsewhere**; you can update notes without a resume, AI provider, or SMTP setup. JobApply never sends or schedules emails for these records, and missing contacts do not create HR reminders. Run `python -m alembic upgrade head` from `backend` and restart the API before using this feature.

Frontend development uses port 8080 by default. If that port is occupied, Vite chooses another port; configure the backend's FRONTEND_URL to allow that origin.

### Learning from job requirements

Open **Learning** in Your toolkit to track skills with Planned, In progress,
Completed, or On hold status. Each skill supports multiple editable notes and
resource links. On any job or application screen, choose a resume and click
**Find skill gaps** to compare its extracted text and your profile details with
the job requirements using your configured AI provider. Review the suggestions
and click **Add / link**, or type a skill manually without AI.

Adding the same skill name (ignoring case and extra spaces) for another job reuses
the existing learning item and adds that job to its links, keeping progress and
notes. Use a consistent name for aliases such as JS and JavaScript. You can search
skills or linked jobs, filter status, unlink jobs, and manage notes/resources in
Learning. All learning data is private to your account. Run `python -m alembic
upgrade head` from `backend` and restart the API for this update. See
[the implementation plan](docs/learning-plan.md).

## 🎯 Key Features

1. **Local-First & Multi-User Isolated**:
   - Each local user has isolated profile data, desired job titles, resumes, LLM API keys, HR contacts, and application records.
   - User ownership is strictly verified on every single backend API endpoint.

2. **IT Park Job Scrapers**:
   - Modular `BaseScraper` with robust parsers for **Infopark** (`infopark.in`), **Technopark** (`technopark.in`), **Cyberpark** (`cyberparks.in`), **UL CyberPark** (`ulcyberpark.com`), and **SmartCity Kochi** (`smartcity-kochi.in`).
   - Deterministic deduplication: re-scraping updates existing jobs without duplicate spam.
   - CLI tools: `scrape_infopark.py`, `scrape_technopark.py`, and unified `run_scrapers.py`.

3. **Resume Management & Extraction**:
   - Local filesystem storage (`backend/uploads/resumes/`).
   - Automatic plain text extraction from **PDF** (`pypdf`) and **DOCX** (`python-docx`).
   - Many-to-many mapping linking resumes to configured desired job titles.

4. **Multi-LLM Automatic Failover**:
   - Supports **OpenRouter**, **Groq**, **Google Gemini**, and **xKiro**.
   - User-defined priority ordering (Priority 1 = primary).
   - If a provider hits a rate limit (HTTP 429), quota exhaustion, or temporary 5xx error, it automatically fails over to the next priority provider.
   - Masked API key previews (`sk-...abcd`) ensuring keys are never exposed in GET responses.
   - In-app "Test API" button to test provider endpoints instantly.

5. **Recruiter Contacts & Application Workflows**:
   - **Crucial Rule**: If a job listing lacks a verified HR/recruiter email, sending is completely prevented and flagged as **HR Contact Required**.
   - Dedicated **HR Contacts Required** page allows users to manually supply recruiter contacts to unlock applications.
   - Manual applications use a dedicated review screen. Auto Apply can send emails automatically after you acknowledge its behavior and start a run.

6. **Async SMTP Email Dispatch**:
   - Send tailored cover letters with your selected resume attached (PDF/DOCX) using your configured SMTP settings (e.g. Gmail App Password, Outlook, or local SMTP).
   - In-app "Test SMTP Connection" button before attempting any live send.

---

## 🏗️ Architecture & Tech Stack

```text
JobApplyer/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point & CORS
│   │   ├── config.py                # Settings & paths
│   │   ├── api/                     # REST API routers (auth, jobs, resumes, llm, email...)
│   │   ├── models/                  # SQLAlchemy 2.0 Mapped models
│   │   ├── schemas/                 # Pydantic request/response validation
│   │   ├── services/
│   │   │   ├── scraper/             # IT park job scraping
│   │   │   ├── llm/                 # OpenRouter, Groq, Gemini & Failover Manager
│   │   │   ├── resume_service.py    # PDF/DOCX text parsing
│   │   │   ├── application_service.py
│   │   │   └── email_service.py     # Async SMTP mailer
│   │   ├── db/                      # Async PostgreSQL / SQLite engine & session
│   │   └── utils/                   # Security (JWT, bcrypt) & logger
│   ├── scripts/                     # Scraper CLI scripts
│   ├── tests/                       # Pytest automated test suite
│   ├── uploads/resumes/             # Local resume file storage
│   ├── alembic/                     # Database migrations
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/                   # Dashboard, Jobs, Resumes, LLM, Email, Applications...
│   │   ├── layouts/                 # MainLayout with sidebar & header
│   │   ├── services/api.ts          # Typed Axios client with auth interceptors
│   │   ├── types/index.ts           # TypeScript interfaces
│   │   └── index.css                # Light dashboard design system
│   ├── package.json
│   └── vite.config.ts
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+** (Tested on Python 3.12)
- **Node.js 18+** and **npm**

---

### Step 1: Backend Setup

1. Open a terminal in the project root:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     python -m venv venv
     source venv/bin/activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure `backend/.env` and run database migrations:
   ```bash
   alembic upgrade head
   ```

   For production PostgreSQL, set
   `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE`.
   Plain `postgresql://` and `postgres://` URLs are normalized to psycopg;
   explicit `postgresql+asyncpg://` URLs are also supported. Alembic uses
   synchronous psycopg while the API and workers use async connections.
   Dependencies include both PostgreSQL drivers. URL-encode special characters
   in passwords and use the same settings for the API, workers, and migrations.
   SQLite remains the zero-configuration local default.

   Run migrations before starting production services. They support fresh
   databases and databases whose tables were previously created at startup.
   Changing `DATABASE_URL` connects to that database; it does not copy existing
   SQLite data into PostgreSQL.

   To run PostgreSQL regression tests, set `POSTGRES_TEST_URL` to a test server
   URL and run `pytest tests/test_database_compatibility.py -v` from `backend`.
   These tests create and remove their own temporary schemas; the test account
   needs permission to create schemas. Without that variable, PostgreSQL
   integration checks are skipped while SQL compilation and SQLite checks run.

5. (Optional) Run automated tests to verify your setup:
   ```bash
   pytest tests -v
   ```

6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API will be live at `http://localhost:8000`. Interactive Swagger documentation is available at `http://localhost:8000/docs`.

---

### Step 2: Populate Jobs via Scraper

In a new terminal (with the virtual environment activated):

```bash
cd backend

# Scrape Infopark listings:
python scripts/scrape_infopark.py --query python --limit 10

# Scrape Technopark listings:
python scripts/scrape_technopark.py --query python --limit 10

# Search the new parks individually:
python scripts/run_scrapers.py --source cyberpark --query python --limit 10
python scripts/run_scrapers.py --source ulcyberpark --query python --limit 10

# Search SmartCity Kochi:
python scripts/run_scrapers.py --source smartcity --query java --limit 10

# Or search all five parks:
python scripts/run_scrapers.py --query python --limit 20
```

Choose **Cyberpark · Kozhikode** or **UL CyberPark · Kozhikode** in Auto apply to discover jobs and prepare applications. Both sources are also available in the Jobs source filter after discovery. Applications still require review and explicit approval before sending.

Cyberpark uses its public keyword-search endpoint. UL CyberPark has no keyword endpoint: the scraper reads published listing pages and filters titles, companies, descriptions, and skills using all search words, regardless of case. Its page number refers to pages of matching results. This can take longer for narrow searches. Neither new scraper generates fallback vacancies: no matches return an empty result, and fetch or parsing failures are reported as errors. The older Infopark and Technopark scrapers retain their existing sample-fallback behavior.

**SmartCity Kochi** is also available in Auto apply and the Jobs source filter. It reads company job posts, filters titles, companies, and descriptions by all search words, and paginates matching results. Recruiter contacts come only from each post, never from park contact details. Published dates are preserved; the site retains older vacancies, so check the original listing before applying. Fetch and layout errors are reported without generating sample jobs.

---

### Step 3: Frontend Setup

1. Open another terminal in the `frontend/` directory:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite React development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to:
   ```text
   http://localhost:8080
   ```

---

## 📖 End-to-End User Walkthrough

1. **Register & Login**:
   - Go to `http://localhost:8080/register` and create your local user account.

2. **Configure Candidate Profile (`/profile`)**:
   - Fill in your Name, Current Company, Location, Current CTC, Expected CTC, Years of Experience, and Notice Period.
   - Click **Save Profile Details**.

3. **Add Desired Job Titles (`/job-titles`)**:
   - Add roles you want to target: e.g. `Python Developer`, `FastAPI Developer`, `Backend Engineer`.

4. **Upload Resumes (`/resumes`)**:
   - Upload your resume (`.pdf` or `.docx`). The backend will automatically parse and index the raw text.
   - Map each resume to one or more of your desired job titles.

5. **Configure LLM Providers (`/llm-providers`)**:
   - Add your API key for **OpenRouter**, **Groq**, or **Google Gemini**.
   - Set Priority (`1` = primary, `2` = failover).
   - Click **Test API** to verify connectivity.

6. **Configure Outgoing SMTP (`/email-settings`)**:
   - Enter your SMTP credentials (for Gmail: Host `smtp.gmail.com`, Port `587`, Username `your.email@gmail.com`, and a Google **App Password**).
   - Click **Test SMTP Connection** to confirm.

7. **Discover & Analyze Jobs (`/jobs`)**:
   - Search for jobs by keyword or portal.
   - Open a job to view its full description and requirements.
   - Click **"Analyze Match"**: The LLM evaluates the role strictly against your configured titles and recommends the best matching resume.
   - Click **"Generate with LLM"**: Generates a tailored cover letter grounded in your actual profile and resume.

8. **HR Contact Safety & Dispatch (`/jobs/:id` or `/applications/:id`)**:
   - If the job already has an HR email: Click **Review & Prepare Application**.
   - If the job has no HR email: The system prevents sending and labels the job as **HR Contact Required**. Click **+ Add HR Contact Email** or visit the `/hr-contacts` page to provide recruiter info.
   - In the application preview screen, review the subject, recipient, attached resume, and cover letter.
   - Click **"Send Application Now"** to dispatch the email with the resume attached via SMTP.
   - View your complete application log in **Application History** (`/applications`).

---

## 🧪 Testing

The backend includes a comprehensive test suite covering:
- Registration, login, and JWT validation
- Strict user data isolation (User A cannot view, modify, or send User B's resources)
- Multi-provider LLM failover upon HTTP 429 rate limit
- HR Contact safety enforcement (preventing sending when HR email is missing)
- Resume upload, parsing, and job title linking

To run tests:
```bash
cd backend
pytest tests -v
```

---

## 🛡️ Privacy & Security Notes
- All data, resumes, database tables, and settings reside strictly on your local disk.
- API keys and SMTP passwords are never exposed in GET responses (previews are masked).
- Manual and Auto Apply applications are saved for review. Auto Apply sends only jobs selected with checkboxes and explicitly approved by the user.


### Scheduled application emails

Use **Schedule send** on the application review screen to choose a future time in
the displayed browser timezone. Schedules persist in the database in UTC. Cancel
the pending schedule to edit or send immediately.

In **Auto apply**, run **Find and prepare applications**, review each email, and
select the jobs you want to apply to. Click **Approve and send now** to send only
those jobs immediately. Enable **Schedule approved emails**, choose a future local
date/time, and click **Approve and schedule** to send them later. Unselected jobs
stay saved without being sent. Manage or cancel pending schedules in Applications.
Already sent or scheduled applications are skipped on subsequent search runs.

Sent applications also support **Schedule send (optional)** in the follow-up
composer. Choose a future local date/time, or leave it empty to send immediately.
Follow-up history shows the scheduled time and lets you cancel pending follow-ups.
Follow-ups use the same worker and Beat setup described below.

From `backend`, install dependencies and migrate existing databases:

```sh
python -m pip install -r requirements.txt
python -m alembic upgrade head
```

Start Redis locally, in Docker, or in WSL. Set `CELERY_BROKER_URL` in `backend/.env`
(default `redis://localhost:6379/0`). In separate terminals from `backend`, run:

```sh
python -m celery -A app.celery_app:celery_app worker --pool=solo --loglevel=info
python -m celery -A app.celery_app:celery_app beat --loglevel=info
```

Use the same database and settings for the API and worker, and run one Beat instance.
The worker checks every 30 seconds and sends via the user's saved SMTP settings.
Redis, Beat, and the worker must remain running; overdue pending emails are sent
when they resume. Failed delivery requires manual retry. Atomic claims prevent
multiple workers sending the same schedule. SMTP is not automatically retried
because delivery acceptance can be ambiguous. A worker crash after claiming leaves
the application Sending; check the sender mailbox before resetting the database status to Ready. Linux/WSL is recommended for production workers.

### xKiro AI provider

In **AI providers**, choose **xKiro**, enter your xKiro API key, and copy a full `vendor/model` identifier from the [xKiro model catalog](https://docs.xkiro.com/api/list-models/). Set its priority, save it, and use **Test API** to check your credentials and model access. The model field is deliberately empty when you select xKiro so you choose a model available to your account.

The backend calls `https://api.xkiro.com/v1/chat/completions` with Bearer authentication. xKiro participates in the existing priority-based failover for job matching and cover letters. JSON output is requested and validated for matching; invalid or truncated output can fail over to the next provider. Existing provider settings need no migration. See the [xKiro API reference](https://docs.xkiro.com/api/chat-completions/).
