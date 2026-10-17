"""Use matching database drivers for the async app and synchronous migrations."""
from sqlalchemy.engine import URL, make_url


def database_url(value: str | URL, *, asynchronous: bool = True) -> URL:
    url = make_url(value)
    if url.drivername == "postgres":
        url = url.set(drivername="postgresql")
    if url.get_backend_name() == "postgresql":
        if not asynchronous or url.drivername in {"postgresql", "postgresql+psycopg2"}:
            return url.set(drivername="postgresql+psycopg")
    elif url.get_backend_name() == "sqlite":
        return url.set(drivername="sqlite+aiosqlite" if asynchronous else "sqlite")
    return url
