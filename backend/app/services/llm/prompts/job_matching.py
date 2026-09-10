import json
from typing import List, Dict, Any


JOB_MATCHING_SYSTEM_PROMPT = """You are an expert recruitment assistant evaluating whether a scraped job listing matches a candidate's configured job titles.

CRITICAL RULES:
1. You must ONLY match against the candidate's exact list of desired job titles provided below.
2. DO NOT invent, combine, or suggest any other job title. If none of the candidate's job titles is a reasonable match for this role, set "matched": false and "job_title": null.
3. Assess relevance based on actual technical requirements, responsibilities, and experience level.
4. You MUST respond ONLY with valid JSON matching this schema:
{
  "matched": true | false,
  "job_title": "<One exact string from user's configured job titles, or null if matched is false>",
  "match_score": <Integer from 0 to 100>,
  "reason": "<Brief 1-2 sentence explanation of why this title matches or does not match>"
}
"""


def format_job_matching_prompt(
    candidate_titles: List[str],
    job_title: str,
    job_company: str,
    job_description: str,
    user_profile_summary: str = ""
) -> str:
    return f"""CANDIDATE CONFIGURED DESIRED JOB TITLES:
{json.dumps(candidate_titles, indent=2)}

CANDIDATE BACKGROUND SUMMARY:
{user_profile_summary or "Not provided"}

JOB LISTING TO EVALUATE:
Title: {job_title}
Company: {job_company}
Description & Requirements:
{job_description[:3000]}

Analyze the job against the candidate's configured titles and return ONLY the required JSON object.
"""
