"""Small parsing helpers shared by the Kozhikode park scrapers."""
from urllib.parse import unquote, urlsplit

from app.services.scraper.base import EMAIL_REGEX, ScrapedJob


def text(element) -> str:
    return element.get_text(" ", strip=True) if element else ""


def matches(job: ScrapedJob, query: str) -> bool:
    haystack = " ".join(filter(None, [job.title, job.company, job.description, job.requirements])).casefold()
    return all(word in haystack for word in query.casefold().split())


def job_email(element) -> str | None:
    """Read contacts only from job content, never the site's header/footer."""
    if element is None:
        return None
    for anchor in element.select('a[href^="mailto:"]'):
        address = unquote(anchor["href"][7:].split("?", 1)[0]).strip()
        if EMAIL_REGEX.fullmatch(address):
            return address
    match = EMAIL_REGEX.search(text(element))
    return match.group(0).rstrip(".,;") if match else None


def valid_url(url: str, host: str, path_prefix: str) -> bool:
    parsed = urlsplit(url)
    return parsed.scheme == "https" and parsed.netloc == host and parsed.path.startswith(path_prefix)


def positive_paging(page: int, limit: int) -> None:
    if page < 1 or limit < 1:
        raise ValueError("Page and limit must be positive")
