import argparse
import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.scraper.registry import SCRAPERS, get_scraper
from scripts.scraper_utils import upsert_scraped_jobs
from app.utils.logger import logger


async def main():
    parser = argparse.ArgumentParser(description="Search IT park company vacancies")
    parser.add_argument("--source", choices=["all", *SCRAPERS], default="all", help="Target portal (default: all registered parks)")
    parser.add_argument("--query", type=str, default="", help="Search query (e.g. 'python')")
    parser.add_argument("--page", type=int, default=1, help="Page number")
    parser.add_argument("--limit", type=int, default=20, help="Maximum number of jobs per source")
    args = parser.parse_args()

    if args.page < 1 or args.limit < 1:
        parser.error("Page and limit must be positive")
    sources = list(SCRAPERS) if args.source == "all" else [args.source]
    all_jobs = []
    failed = []
    for source in sources:
        try:
            jobs = await get_scraper(source).search(query=args.query, page=args.page, limit=args.limit)
            logger.info(f"{source}: found {len(jobs)} jobs.")
            all_jobs.extend(jobs)
        except Exception as exc:
            failed.append(source)
            logger.error(f"{source}: scraping failed: {exc}")
    inserted, updated = await upsert_scraped_jobs(all_jobs)
    logger.info(f"=== Scraping complete: {len(all_jobs)} total processed ({inserted} inserted, {updated} updated) ===")
    if failed:
        raise SystemExit(f"Failed sources: {', '.join(failed)}")


if __name__ == "__main__":
    asyncio.run(main())
