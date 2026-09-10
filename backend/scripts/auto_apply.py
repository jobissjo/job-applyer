import argparse
import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal, init_db
from app.models.user import User
from app.services.auto_apply_service import AutoApplyService
from app.utils.logger import logger


async def main():
    parser = argparse.ArgumentParser(description="Automate job search, resume matching/synthesis, cover letter generation, and apply")
    parser.add_argument("--user-email", type=str, default="jobiss2002@gmail.com", help="Email of local user")
    parser.add_argument("--source", type=str, default="technopark", choices=["technopark", "infopark"], help="Target portal")
    parser.add_argument("--query", type=str, default="python", help="Search keyword (e.g. 'python', 'fastapi')")
    parser.add_argument("--page", type=int, default=1, help="Portal page number")
    parser.add_argument("--limit", type=int, default=5, help="Number of listings to process")
    args = parser.parse_args()

    await init_db()

    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == args.user_email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            print(f"Error: User with email '{args.user_email}' not found in database.")
            print("Please create the user first or register via the frontend.")
            sys.exit(1)

        print("=================================================================")
        print(f"[*] STARTING AUTO-APPLY PIPELINE FOR: {user.email}")
        print(f"Portal: {args.source.upper()} | Query: '{args.query}' | Page: {args.page} | Limit: {args.limit}")
        print("=================================================================")

        report = await AutoApplyService.run_pipeline(
            user_id=user.id,
            source=args.source,
            query=args.query,
            page=args.page,
            limit=args.limit,
            db=session
        )

        print("\n======================= PIPELINE RESULTS =======================")
        print(f"Total Jobs Processed: {report['total_processed']}")
        print(f"Applications Sent:    {report['applied_count']}")
        print(f"Applications Ready:   {report['ready_count']}")
        print(f"HR Contact Required:  {report['hr_required_count']}")
        print("-----------------------------------------------------------------")
        for idx, job in enumerate(report["jobs"], start=1):
            print(f"\n[{idx}] {job['title']} @ {job['company']}")
            print(f"    HR Email:     {job['hr_email'] or 'NOT FOUND'}")
            print(f"    Matched Role: {job['matched_title']}")
            print(f"    Resume:       {job['resume_used']}")
            print(f"    Status:       {job['status'].upper()}")
            print(f"    Note:         {job['message']}")
        print("=================================================================")


if __name__ == "__main__":
    asyncio.run(main())
