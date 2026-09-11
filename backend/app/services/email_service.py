import os
from email.message import EmailMessage
from pathlib import Path
from typing import Optional
import aiosmtplib

from app.models.email_settings import EmailSettings
from app.utils.logger import logger


class EmailService:
    @staticmethod
    async def test_connection(settings: EmailSettings) -> tuple[bool, str]:
        try:
            smtp_client = aiosmtplib.SMTP(
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                start_tls=settings.use_tls if settings.smtp_port != 465 else False,
                use_tls=True if settings.smtp_port == 465 else False,
                timeout=15.0
            )
            await smtp_client.connect()
            if settings.smtp_username and settings.smtp_password:
                await smtp_client.login(settings.smtp_username, settings.smtp_password)
            await smtp_client.quit()
            return True, "SMTP connection and authentication successful."
        except Exception as e:
            logger.warning(f"SMTP test failed: {e}")
            return False, f"SMTP connection failed: {str(e)}"

    @staticmethod
    async def send_application_email(
        settings: EmailSettings,
        to_email: str,
        subject: str,
        cover_letter_text: str,
        resume_path: Optional[str] = None,
        attachment_filename: Optional[str] = None,
    ) -> tuple[bool, str]:
        if not to_email:
            return False, "Recipient email is missing."

        try:
            message = EmailMessage()
            message["From"] = settings.from_email
            message["To"] = to_email
            message["Subject"] = subject

            # Plain text body
            message.set_content(cover_letter_text)

            # Attach resume if specified and exists
            if resume_path and os.path.exists(resume_path):
                file_p = Path(resume_path)
                with open(file_p, "rb") as f:
                    file_data = f.read()
                    file_name = attachment_filename or file_p.name

                maintype = "application"
                subtype = "pdf" if file_name.lower().endswith(".pdf") else "octet-stream"
                message.add_attachment(
                    file_data,
                    maintype=maintype,
                    subtype=subtype,
                    filename=file_name
                )
                logger.info(f"Attached resume as '{file_name}' ({len(file_data)} bytes) to email.")

            smtp_client = aiosmtplib.SMTP(
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                start_tls=settings.use_tls if settings.smtp_port != 465 else False,
                use_tls=True if settings.smtp_port == 465 else False,
                timeout=25.0
            )
            await smtp_client.connect()
            if settings.smtp_username and settings.smtp_password:
                await smtp_client.login(settings.smtp_username, settings.smtp_password)
            await smtp_client.send_message(message)
            await smtp_client.quit()

            logger.info(f"Application email successfully sent to {to_email}")
            return True, f"Application successfully sent to {to_email}"

        except Exception as e:
            err_msg = f"Failed to send email to {to_email}: {str(e)}"
            logger.error(err_msg)
            return False, err_msg
