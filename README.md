# Local Job Auto-Apply System

A local-only, developer-friendly job discovery and application assistant built with **FastAPI**, **React + TypeScript**, **Async SQLite + SQLAlchemy 2.0 (`Mapped` / `mapped_column`)**, **Alembic**, and multi-provider **LLM Failover** (OpenRouter, Groq, Gemini).

Designed strictly for personal use on your local workstation. No Docker required, no microservices, no cloud vendor lock-in, and zero unsolicited automated email spam.

---

## 🎯 Key Features

1. **Local-First & Multi-User Isolated**:
   - Each local user has isolated profile data, desired job titles, resumes, LLM API keys, HR contacts, and application records.
   - User ownership is strictly verified on every single backend API endpoint.

2. **Infopark & Technopark Scrapers**:
   - Modular `BaseScraper` with robust parsers for **Infopark** (`infopark.in`) and **Technopark** (`technopark.org`).
   - Deterministic deduplication: re-scraping updates existing jobs without duplicate spam.
   - CLI tools: `scrape_infopark.py`, `scrape_technopark.py`, and unified `run_scrapers.py`.

3. **Resume Management & Extraction**:
   - Local filesystem storage (`backend/uploads/resumes/`).
   - Automatic plain text extraction from **PDF** (`pypdf`) and **DOCX** (`python-docx`).
   - Many-to-many mapping linking resumes to configured desired job titles.

4. **Multi-LLM Automatic Failover**:
   - Supports **OpenRouter**, **Groq**, and **Google Gemini**.
   - User-defined priority ordering (Priority 1 = primary).
   - If a provider hits a rate limit (HTTP 429), quota exhaustion, or temporary 5xx error, it automatically fails over to the next priority provider.
   - Masked API key previews (`sk-...abcd`) ensuring keys are never exposed in GET responses.
   - In-app "Test API" button to test provider endpoints instantly.

5. **Safety-First HR Contact Verification (No Unsolicited Auto-Send)**:
   - **Crucial Rule**: If a job listing lacks a verified HR/recruiter email, sending is completely prevented and flagged as **HR Contact Required**.
   - Dedicated **HR Contacts Required** page allows users to manually supply recruiter contacts to unlock applications.
   - Every application requires explicit human review and clicking **"Send Application"**.

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
│   │   │   ├── scraper/             # Infopark & Technopark scraping
│   │   │   ├── llm/                 # OpenRouter, Groq, Gemini & Failover Manager
│   │   │   ├── resume_service.py    # PDF/DOCX text parsing
│   │   │   ├── application_service.py
│   │   │   └── email_service.py     # Async SMTP mailer
│   │   ├── db/                      # Async SQLite engine & session
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
│   │   └── index.css                # Dark-mode dashboard design system
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

4. Run database migrations:
   ```bash
   alembic upgrade head
   ```

5. (Optional) Run automated tests to verify your setup:
   ```bash
   pytest -v
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

# Or run both simultaneously:
python scripts/run_scrapers.py --query python --limit 20
```

*Note: If the remote portals are temporarily unreachable or rate-limited, the scrapers automatically provide realistic structured fallback listings for smooth local testing.*

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
   http://localhost:5173
   ```

---

## 📖 End-to-End User Walkthrough

1. **Register & Login**:
   - Go to `http://localhost:5173/register` and create your local user account.

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
pytest -v
```

---

## 🛡️ Privacy & Security Notes
- All data, resumes, database tables, and settings reside strictly on your local disk.
- API keys and SMTP passwords are never exposed in GET responses (previews are masked).
- Emails are **never** sent automatically without explicit user confirmation.
