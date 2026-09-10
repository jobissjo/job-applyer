import os
import sys
from pathlib import Path
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.models.profile import UserProfile
from app.models.job import Job
from app.utils.security import hash_password, create_access_token

TEST_DB_FILE = backend_dir / "test_job_auto_apply.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    if TEST_DB_FILE.exists():
        try:
            TEST_DB_FILE.unlink()
        except Exception:
            pass
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    if TEST_DB_FILE.exists():
        try:
            TEST_DB_FILE.unlink()
        except Exception:
            pass


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


import uuid

@pytest_asyncio.fixture
async def user_a(db_session):
    uid = uuid.uuid4().hex[:6]
    email = f"user_a_{uid}@example.com"
    u = User(email=email, hashed_password=hash_password("Password123!"))
    db_session.add(u)
    await db_session.flush()
    prof = UserProfile(user_id=u.id, name="User A", current_company="Alpha Corp")
    db_session.add(prof)
    await db_session.commit()
    await db_session.refresh(u)
    token = create_access_token(data={"sub": str(u.id)})
    return {"user": u, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest_asyncio.fixture
async def user_b(db_session):
    uid = uuid.uuid4().hex[:6]
    email = f"user_b_{uid}@example.com"
    u = User(email=email, hashed_password=hash_password("Password123!"))
    db_session.add(u)
    await db_session.flush()
    prof = UserProfile(user_id=u.id, name="User B", current_company="Beta LLC")
    db_session.add(prof)
    await db_session.commit()
    await db_session.refresh(u)
    token = create_access_token(data={"sub": str(u.id)})
    return {"user": u, "token": token, "headers": {"Authorization": f"Bearer {token}"}}



@pytest_asyncio.fixture
async def sample_job(db_session):
    jid = f"test-job-{uuid.uuid4().hex[:6]}"
    j = Job(
        source="infopark",
        source_job_id=jid,
        title="Python Engineer",
        company="GlobalTech Infopark",
        location="Kochi",
        job_url="https://infopark.in/job/1",
        description="Looking for Python and FastAPI specialist.",
        contact_email="careers@globaltech.com"
    )
    db_session.add(j)
    await db_session.commit()
    await db_session.refresh(j)
    return j


@pytest_asyncio.fixture
async def sample_job_no_hr(db_session):
    jid = f"test-job-no-hr-{uuid.uuid4().hex[:6]}"
    j = Job(
        source="technopark",
        source_job_id=jid,
        title="Junior Developer",
        company="Secretive Tech",
        location="Thiruvananthapuram",
        job_url="https://technopark.org/job/2",
        description="Software development role.",
        contact_email=None
    )
    db_session.add(j)
    await db_session.commit()
    await db_session.refresh(j)
    return j

