"""Initial schema.

Revision ID: 7833ab33d6d5
Revises:

Frozen baseline for fresh installations. Existing tables created by earlier
application versions are retained; subsequent revisions add newer features.
"""
from alembic import op
import sqlalchemy as sa

revision = "7833ab33d6d5"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "jobs" not in existing:
        op.create_table('jobs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('source_job_id', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('job_url', sa.String(length=1000), nullable=False),
        sa.Column('detail_url', sa.String(length=1000), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('requirements', sa.Text(), nullable=True),
        sa.Column('contact_name', sa.String(length=255), nullable=True),
        sa.Column('contact_email', sa.String(length=255), nullable=True),
        sa.Column('contact_phone', sa.String(length=100), nullable=True),
        sa.Column('posted_date', sa.String(length=100), nullable=True),
        sa.Column('scraped_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('raw_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source', 'source_job_id', name='uq_source_job_id')
        )
        op.create_index(op.f('ix_jobs_company'), 'jobs', ['company'], unique=False)
        op.create_index(op.f('ix_jobs_contact_email'), 'jobs', ['contact_email'], unique=False)
        op.create_index(op.f('ix_jobs_source'), 'jobs', ['source'], unique=False)
        op.create_index(op.f('ix_jobs_source_job_id'), 'jobs', ['source_job_id'], unique=False)
        op.create_index(op.f('ix_jobs_title'), 'jobs', ['title'], unique=False)
    if "users" not in existing:
        op.create_table('users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    if "email_settings" not in existing:
        op.create_table('email_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('smtp_host', sa.String(length=255), nullable=False),
        sa.Column('smtp_port', sa.Integer(), nullable=False),
        sa.Column('smtp_username', sa.String(length=255), nullable=False),
        sa.Column('smtp_password', sa.String(length=255), nullable=False),
        sa.Column('from_email', sa.String(length=255), nullable=False),
        sa.Column('use_tls', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_email_settings_user_id'), 'email_settings', ['user_id'], unique=True)
    if "hr_contacts" not in existing:
        op.create_table('hr_contacts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=True),
        sa.Column('contact_name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=100), nullable=True),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_hr_contacts_job_id'), 'hr_contacts', ['job_id'], unique=False)
        op.create_index(op.f('ix_hr_contacts_user_id'), 'hr_contacts', ['user_id'], unique=False)
    if "job_title_preferences" not in existing:
        op.create_table('job_title_preferences',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_job_title_preferences_title'), 'job_title_preferences', ['title'], unique=False)
        op.create_index(op.f('ix_job_title_preferences_user_id'), 'job_title_preferences', ['user_id'], unique=False)
    if "llm_providers" not in existing:
        op.create_table('llm_providers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('api_key', sa.String(length=500), nullable=False),
        sa.Column('model', sa.String(length=255), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_llm_providers_user_id'), 'llm_providers', ['user_id'], unique=False)
    if "llm_usage_logs" not in existing:
        op.create_table('llm_usage_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=255), nullable=False),
        sa.Column('request_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('error_type', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_llm_usage_logs_user_id'), 'llm_usage_logs', ['user_id'], unique=False)
    if "resumes" not in existing:
        op.create_table('resumes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('resume_type', sa.String(length=50), nullable=False),
        sa.Column('extracted_text', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_resumes_user_id'), 'resumes', ['user_id'], unique=False)
    if "user_profiles" not in existing:
        op.create_table('user_profiles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('current_company', sa.String(length=255), nullable=True),
        sa.Column('current_ctc', sa.String(length=100), nullable=True),
        sa.Column('expected_ctc', sa.String(length=100), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('years_of_experience', sa.Float(), nullable=True),
        sa.Column('notice_period', sa.String(length=100), nullable=True),
        sa.Column('linkedin_url', sa.String(length=500), nullable=True),
        sa.Column('github_url', sa.String(length=500), nullable=True),
        sa.Column('portfolio_url', sa.String(length=500), nullable=True),
        sa.Column('additional_details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_user_profiles_user_id'), 'user_profiles', ['user_id'], unique=True)
    if "cover_letters" not in existing:
        op.create_table('cover_letters',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('job_title', sa.String(length=255), nullable=False),
        sa.Column('resume_id', sa.Integer(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resume_id'], ['resumes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_cover_letters_job_id'), 'cover_letters', ['job_id'], unique=False)
        op.create_index(op.f('ix_cover_letters_user_id'), 'cover_letters', ['user_id'], unique=False)
    if "resume_job_titles" not in existing:
        op.create_table('resume_job_titles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('resume_id', sa.Integer(), nullable=False),
        sa.Column('job_title_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['job_title_id'], ['job_title_preferences.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resume_id'], ['resumes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('resume_id', 'job_title_id', name='uq_resume_job_title')
        )
        op.create_index(op.f('ix_resume_job_titles_job_title_id'), 'resume_job_titles', ['job_title_id'], unique=False)
        op.create_index(op.f('ix_resume_job_titles_resume_id'), 'resume_job_titles', ['resume_id'], unique=False)
    if "applications" not in existing:
        op.create_table('applications',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('resume_id', sa.Integer(), nullable=True),
        sa.Column('cover_letter_id', sa.Integer(), nullable=True),
        sa.Column('hr_contact_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('email_subject', sa.String(length=500), nullable=True),
        sa.Column('sent_to', sa.String(length=255), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['cover_letter_id'], ['cover_letters.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['hr_contact_id'], ['hr_contacts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resume_id'], ['resumes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_applications_job_id'), 'applications', ['job_id'], unique=False)
        op.create_index(op.f('ix_applications_status'), 'applications', ['status'], unique=False)
        op.create_index(op.f('ix_applications_user_id'), 'applications', ['user_id'], unique=False)


def downgrade():
    op.drop_table("applications")
    op.drop_table("resume_job_titles")
    op.drop_table("cover_letters")
    op.drop_table("user_profiles")
    op.drop_table("resumes")
    op.drop_table("llm_usage_logs")
    op.drop_table("llm_providers")
    op.drop_table("job_title_preferences")
    op.drop_table("hr_contacts")
    op.drop_table("email_settings")
    op.drop_table("users")
    op.drop_table("jobs")
