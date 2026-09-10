COVER_LETTER_SYSTEM_PROMPT = """You are a seasoned professional executive career coach.
Your task is to write a concise, compelling, and tailored job application cover letter for a candidate.

STRICT GUIDELINES:
1. NEVER invent companies, degrees, years of experience, or skills not present in the candidate's profile or resume.
2. Maintain a professional, confident, and engaging tone.
3. Highlight specific alignments between the candidate's real experience and the target job requirements.
4. Keep the letter concise (around 3 to 4 well-structured paragraphs, maximum 300 words).
5. Address the hiring team respectfully.
6. Provide ONLY the text of the cover letter ready to be placed directly into an email body or attachment. Do not include markdown meta-commentary, placeholders like '[Insert Date]', or postscripts.
"""


def format_cover_letter_prompt(
    candidate_profile: dict,
    target_job_title: str,
    job_company: str,
    job_description: str,
    resume_text: str = "",
    custom_instructions: str = ""
) -> str:
    profile_lines = []
    if candidate_profile.get("name"):
        profile_lines.append(f"Name: {candidate_profile['name']}")
    if candidate_profile.get("current_company"):
        profile_lines.append(f"Current Company: {candidate_profile['current_company']}")
    if candidate_profile.get("years_of_experience"):
        profile_lines.append(f"Years of Experience: {candidate_profile['years_of_experience']}")
    if candidate_profile.get("location"):
        profile_lines.append(f"Location: {candidate_profile['location']}")
    if candidate_profile.get("notice_period"):
        profile_lines.append(f"Notice Period: {candidate_profile['notice_period']}")
    if candidate_profile.get("additional_details"):
        profile_lines.append(f"Additional Details: {candidate_profile['additional_details']}")

    profile_str = "\n".join(profile_lines) if profile_lines else "General Candidate"

    prompt = f"""CANDIDATE PROFILE:
{profile_str}

MATCHED JOB TITLE:
{target_job_title}

TARGET COMPANY:
{job_company}

JOB DESCRIPTION & REQUIREMENTS:
{job_description[:3000]}

CANDIDATE RESUME SUMMARY/TEXT:
{resume_text[:3000] if resume_text else "Details in candidate profile"}
"""

    if custom_instructions:
        prompt += f"\nADDITIONAL USER INSTRUCTIONS:\n{custom_instructions}\n"

    prompt += "\nPlease write the complete tailored cover letter now."
    return prompt
