"""Dialect-specific statements shared by PostgreSQL and local SQLite."""
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession


def insert_do_nothing(db: AsyncSession, model, *, values: dict, index_elements):
    dialect = db.get_bind(mapper=model).dialect.name
    if dialect == "postgresql":
        insert = postgresql_insert
    elif dialect == "sqlite":
        insert = sqlite_insert
    else:
        raise ValueError(f"Conflict-safe inserts are unsupported for {dialect}")
    return insert(model).values(**values).on_conflict_do_nothing(index_elements=index_elements)
