import argparse
import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.scraper.infopark import InfoparkScraper
from app.services.scraper.technopark import TechnoparkScraper
from scripts.scraper_utils import upsert_scraped_jobs
from app.utils.logger import logger


async def main():
    parser = argparse.ArgumentParser(description="Run both Infopark and Technopark scrapers")
    parser.add_argument("--query", type=str, default="", help="Search query (e.g. 'python')")
    parser.add_argument("--page", type=int, default=1, help="Page number")
    parser.add_argument("--limit", type=int, default=20, help="Maximum number of jobs per source")
    args = parser.parse_args()

    logger.info(f"=== Running Infopark and Technopark scrapers for query='{args.query}' ===")

    info_scraper = InfoparkScraper()
    tp_scraper = TechnoparkScraper()

    info_jobs = await info_scraper.search(query=args.query, page=args.page, limit=args.limit)
    logger.info(f"Infopark: found {len(info_jobs)} jobs.")

    tp_jobs = await tp_scraper.search(query=args.query, page=args.page, limit=args.limit)
    logger.info(f"Technopark: found {len(tp_jobs)} jobs.")

    all_jobs = info_jobs + tp_jobs
    inserted, updated = await upsert_scraped_jobs(all_jobs)
    logger.info(f"=== Scraping complete: {len(all_jobs)} total processed ({inserted} inserted, {updated} updated) ===")


if __name__ == "__main__":
    asyncio.run(main())
