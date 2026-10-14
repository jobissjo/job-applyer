export interface User {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: number;
  user_id: number;
  name: string;
  phone?: string;
  current_company?: string;
  current_ctc?: string;
  expected_ctc?: string;
  location?: string;
  years_of_experience?: number;
  notice_period?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  additional_details?: string;
}

export interface JobTitle {
  id: number;
  user_id: number;
  title: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: number;
  user_id: number;
  title: string;
  file_name: string;
  file_path: string;
  resume_type: string;
  extracted_text?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  mapped_job_titles: JobTitle[];
}

export interface Job {
  id: number;
  source: string;
  source_job_id: string;
  title: string;
  company: string;
  location?: string;
  job_url: string;
  detail_url?: string;
  description?: string;
  requirements?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  posted_date?: string;
  scraped_at: string;
  created_at: string;
  updated_at: string;
  raw_data?: string;
  has_hr_contact: boolean;
  is_applied: boolean;
  application_status?: string;
}

export interface JobPagination {
  items: Job[];
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
}

export interface JobAnalyzeResponse {
  matched: boolean;
  job_title?: string;
  job_title_id?: number;
  match_score: number;
  reason: string;
  recommended_resume_id?: number;
  recommended_resume_title?: string;
  has_hr_contact: boolean;
  hr_email?: string;
}

export interface LLMProvider {
  id: number;
  user_id: number;
  provider: 'openrouter' | 'groq' | 'gemini';
  model: string;
  priority: number;
  active: boolean;
  enabled: boolean;
  api_key_configured: boolean;
  api_key_preview: string;
  created_at: string;
  updated_at: string;
}

export interface HRContact {
  id: number;
  user_id: number;
  job_id: number;
  company?: string;
  contact_name?: string;
  email: string;
  phone?: string;
  source: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CoverLetter {
  id: number;
  user_id: number;
  job_id: number;
  job_title: string;
  resume_id?: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: number;
  user_id: number;
  job_id: number;
  resume_id?: number;
  cover_letter_id?: number;
  hr_contact_id?: number;
  status: 'draft' | 'hr_contact_required' | 'ready' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  email_subject?: string;
  sent_to?: string;
  sent_at?: string;
  scheduled_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  job?: Job;
  resume?: Resume;
  cover_letter?: CoverLetter;
  hr_contact?: HRContact;
}

export interface ApplicationPreview {
  application_id?: number;
  job_id: number;
  job_title: string;
  company: string;
  recipient_email?: string;
  has_hr_contact: boolean;
  email_subject: string;
  cover_letter_text: string;
  resume_title?: string;
  resume_file_name?: string;
  can_send: boolean;
  reason_cannot_send?: string;
}

export interface EmailSettings {
  id: number;
  user_id: number;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  from_email: string;
  use_tls: boolean;
  password_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_jobs: number;
  applications_ready: number;
  applications_sent: number;
  hr_contacts_required: number;
  applications_failed: number;
  total_hr_contacts_added: number;
  total_applications: number;
}

export interface ApplicationFollowUp {
  id: number;
  application_id: number;
  recipient: string;
  subject: string;
  body: string;
  attach_resume: boolean;
  status: 'scheduled' | 'cancelled' | 'sending' | 'sent' | 'failed';
  scheduled_at?: string;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}
