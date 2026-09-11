import pytest
from unittest.mock import AsyncMock, patch
from app.services.application_service import ApplicationService
from app.services.email_service import EmailService
from app.models.email_settings import EmailSettings
from app.models.job import Job
from app.models.resume import Resume
from app.models.application import Application
from app.models.profile import UserProfile


def test_formatted_attachment_name_generation():
    # Standard name and job title
    name1 = ApplicationService.get_formatted_attachment_name("Jobi", "Python Developer", "user_1_d26f588dee.pdf")
    assert name1 == "Jobi_(Python Developer).pdf"

    # Title with dashes and spaces
    name2 = ApplicationService.get_formatted_attachment_name("Jobi", "Associate Architect - Python", "user_1_abc.pdf")
    assert name2 == "Jobi_(Associate Architect - Python).pdf"

    # Title with invalid filename characters like / and :
    name3 = ApplicationService.get_formatted_attachment_name("Jobi", "Fullstack / Backend Developer", "user_1_xyz.pdf")
    assert name3 == "Jobi_(Fullstack - Backend Developer).pdf"

    # Docx extension
    name4 = ApplicationService.get_formatted_attachment_name("Jobi", "Senior Engineer", "user_1_doc.docx")
    assert name4 == "Jobi_(Senior Engineer).docx"


@pytest.mark.asyncio
async def test_send_application_passes_formatted_attachment_name(db_session, user_a):
    user_id = user_a["user"].id
    
    # 1. Update user profile name to "Jobi"
    prof = (await db_session.execute(
        UserProfile.__table__.select().where(UserProfile.user_id == user_id)
    )).first()
    if prof:
        user_prof = await db_session.get(UserProfile, prof.id)
        user_prof.name = "Jobi"
    else:
        user_prof = UserProfile(user_id=user_id, name="Jobi")
        db_session.add(user_prof)

    # 2. Add SMTP settings
    smtp = EmailSettings(
        user_id=user_id,
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="jobi@example.com",
        smtp_password="password",
        from_email="jobi@example.com",
        use_tls=True
    )
    db_session.add(smtp)

    # 3. Add Job
    job = Job(
        source="infopark",
        source_job_id="test-job-1",
        title="Associate Architect - Python",
        company="Techversant",
        location="Kochi",
        contact_email="hr@techversant.com",
        job_url="https://infopark.in/job/1"
    )
    db_session.add(job)
    await db_session.flush()

    # 4. Add Resume with raw disk filename user_1_d26f588dee.pdf
    resume = Resume(
        user_id=user_id,
        title="Python Resume",
        file_name="Jobi_Full_Stack_Developer.pdf",
        file_path="uploads/resumes/user_1_d26f588dee.pdf",
        resume_type="pdf",
        active=True
    )
    db_session.add(resume)
    await db_session.flush()

    # 5. Create Application
    app = Application(
        user_id=user_id,
        job_id=job.id,
        resume_id=resume.id,
        status="ready"
    )
    db_session.add(app)
    await db_session.commit()

    # 6. Mock EmailService.send_application_email and send application
    with patch("app.services.email_service.EmailService.send_application_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = (True, "Application successfully sent to hr@techversant.com")
        
        sent_app = await ApplicationService.send_application(
            user_id=user_id,
            application_id=app.id,
            db=db_session
        )

        assert sent_app.status == "sent"
        assert mock_send.called
        kwargs = mock_send.call_args.kwargs
        assert kwargs["to_email"] == "hr@techversant.com"
        assert kwargs["resume_path"] == "uploads/resumes/user_1_d26f588dee.pdf"
        assert kwargs["attachment_filename"] == "Jobi_(Associate Architect - Python).pdf"
