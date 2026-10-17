"""Database regressions; POSTGRES_TEST_URL enables checks against a real server."""
import os
from pathlib import Path
from unittest.mock import Mock
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.learning import create_item
from app.db.statements import insert_do_nothing
from app.db.urls import database_url
from app.models import Base
from app.models.learning import LearningItem, LearningJob
from app.models.job import Job
from app.models.user import User
from app.schemas.learning import LearningCreate


@pytest.mark.parametrize("driver", ["postgres", "postgresql", "postgresql+psycopg2", "postgresql+psycopg", "postgresql+asyncpg"])
def test_postgres_urls(driver):
    value = f"{driver}://user:p%40ss%25word@localhost:5432/jobs?sslmode=require"
    async_url = database_url(value)
    assert async_url.drivername == (driver if driver in {"postgresql+psycopg", "postgresql+asyncpg"} else "postgresql+psycopg")
    sync_url = database_url(value, asynchronous=False)
    assert sync_url.drivername == "postgresql+psycopg"
    assert sync_url.password == "p@ss%word"
    assert sync_url.query == {"sslmode": "require"}


def test_sqlite_urls():
    assert database_url("sqlite:///local.db").drivername == "sqlite+aiosqlite"
    assert database_url("sqlite+aiosqlite:///local.db", asynchronous=False).drivername == "sqlite"


@pytest.mark.asyncio
@pytest.mark.parametrize("driver", ["postgresql+psycopg", "postgresql+asyncpg"])
async def test_postgresql_engine_drivers(driver):
    pytest.importorskip(driver.split("+")[1])
    pytest.importorskip("psycopg")
    value = f"{driver}://user:password@localhost/jobs"
    async_engine = create_async_engine(database_url(value))
    sync_engine = create_engine(database_url(value, asynchronous=False))
    try:
        assert async_engine.dialect.is_async
        assert not sync_engine.dialect.is_async
        assert async_engine.dialect.name == sync_engine.dialect.name == "postgresql"
    finally:
        await async_engine.dispose()
        sync_engine.dispose()


@pytest.mark.parametrize("dialect", [postgresql.dialect(), sqlite.dialect()])
@pytest.mark.parametrize("model,values,keys", [
    (LearningItem, {"user_id": 1, "skill": "SQL", "skill_key": "sql", "status": "planned"}, ["user_id", "skill_key"]),
    (LearningJob, {"item_id": 1, "job_id": 2}, ["item_id", "job_id"]),
])
def test_conflict_inserts_compile_for_database(dialect, model, values, keys):
    db = Mock()
    db.get_bind.return_value.dialect = dialect
    statement = insert_do_nothing(db, model, values=values, index_elements=keys)
    sql = str(statement.compile(dialect=dialect))
    assert f"ON CONFLICT ({', '.join(keys)}) DO NOTHING" in sql
    if dialect.name == "postgresql" and model is LearningItem:
        assert "RETURNING learning_items.id" in sql


@pytest.fixture(params=["sqlite", "postgresql"])
def migration_connection(request, tmp_path):
    if request.param == "sqlite":
        engine = create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
        with engine.connect() as connection:
            yield connection
        engine.dispose()
        return
    value = os.environ.get("POSTGRES_TEST_URL")
    if not value:
        pytest.skip("Set POSTGRES_TEST_URL to test a real PostgreSQL server")
    engine = create_engine(database_url(value, asynchronous=False), poolclass=NullPool)
    schema = f"test_compat_{uuid4().hex}"
    with engine.connect() as connection:
        connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        connection.exec_driver_sql(f'SET search_path TO "{schema}"')
        connection.commit()
        try:
            yield connection
        finally:
            connection.rollback()
            connection.exec_driver_sql('SET search_path TO public')
            connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
            connection.commit()
    engine.dispose()


@pytest.mark.parametrize("existing_schema", [False, True])
def test_migrations_match_models(migration_connection, existing_schema):
    connection = migration_connection
    if existing_schema:
        Base.metadata.create_all(connection)
        connection.commit()
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    config.attributes["connection"] = connection
    command.upgrade(config, "head")
    assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    # Re-running deploy migrations preserves an already upgraded database.
    command.upgrade(config, "head")


@pytest.mark.asyncio
async def test_learning_post_on_postgresql(migration_connection):
    if migration_connection.dialect.name != "postgresql":
        pytest.skip("PostgreSQL integration test")
    schema = migration_connection.exec_driver_sql("SELECT current_schema()").scalar_one()
    Base.metadata.create_all(migration_connection)
    migration_connection.commit()
    url = database_url(os.environ["POSTGRES_TEST_URL"], asynchronous=False)
    engine = create_async_engine(url, connect_args={"options": f"-csearch_path={schema}"}, poolclass=NullPool)
    try:
        async with AsyncSession(engine, expire_on_commit=False) as db:
            user = User(email=f"{uuid4().hex}@example.com", hashed_password="unused")
            job = Job(source="test", source_job_id=uuid4().hex, title="SQL developer", company="Test", job_url="https://example.com/job")
            db.add_all([user, job])
            await db.commit()
            first = await create_item(LearningCreate(skill=" SQL ", job_ids=[job.id]), user, db)
            item = await db.get(LearningItem, first.id)
            item.status = "in_progress"
            await db.commit()
            second = await create_item(LearningCreate(skill="sql", job_ids=[job.id, job.id]), user, db)
            assert second.id == first.id
            assert second.status == "in_progress"
            assert len(second.jobs) == 1
            assert len((await db.scalars(select(LearningItem))).all()) == 1
            assert len((await db.scalars(select(LearningJob))).all()) == 1
    finally:
        await engine.dispose()
