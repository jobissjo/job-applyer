import argparse
import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.scraper.technopark import TechnoparkScraper
from scripts.scraper_utils import upsert_scraped_jobs
from app.utils.logger import logger


async def main():
    parser = argparse.ArgumentParser(description="Scrape jobs from Technopark")
    parser.add_argument("--query", type=str, default="", help="Search query (e.g. 'python')")
    parser.add_argument("--page", type=int, default=1, help="Page number")
    parser.add_argument("--limit", type=int, default=20, help="Maximum number of jobs to fetch")
    args = parser.parse_args()

    logger.info(f"Starting Technopark scraper: query='{args.query}', page={args.page}, limit={args.limit}")
    scraper = TechnoparkScraper()
    jobs = await scraper.search(query=args.query, page=args.page, limit=args.limit)
    logger.info(f"Found {len(jobs)} jobs from Technopark.")

    inserted, updated = await upsert_scraped_jobs(jobs)
    logger.info(f"Technopark scraping completed: {inserted} inserted, {updated} updated.")


if __name__ == "__main__":
    asyncio.run(main())
