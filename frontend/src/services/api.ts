import axios from 'axios';
import {
  User,
  UserProfile,
  JobTitle,
  Resume,
  Job,
  JobPagination,
  JobAnalyzeResponse,
  LLMProvider,
  HRContact,
  CoverLetter,
  Application,
  ApplicationFollowUp,
  ApplicationPreview,
  EmailSettings,
  DashboardStats,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(err: any, fallback: string = 'An unexpected error occurred'): string {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === 'string') return item;
        const loc = Array.isArray(item.loc) ? item.loc.filter((l: any) => l !== 'body').join('.') : '';
        return loc ? `${loc}: ${item.msg}` : item.msg || JSON.stringify(item);
      })
      .join(', ');
  }
  if (typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return String(detail);
}

// Intercept 401 responses and normalize error detail
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    if (error.response?.data?.detail && typeof error.response.data.detail !== 'string') {
      error.response.data.detail = formatApiError(error);
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<{ access_token: string }>('/auth/login', { email, password });
    return res.data;
  },
  register: async (email: string, password: string) => {
    const res = await api.post<User>('/auth/register', { email, password });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },
};

export const profileApi = {
  getProfile: async () => {
    const res = await api.get<UserProfile>('/profile');
    return res.data;
  },
  updateProfile: async (data: Partial<UserProfile>) => {
    const res = await api.put<UserProfile>('/profile', data);
    return res.data;
  },
};

export const jobTitlesApi = {
  list: async () => {
    const res = await api.get<JobTitle[]>('/job-titles');
    return res.data;
  },
  create: async (title: string, active: boolean = true) => {
    const res = await api.post<JobTitle>('/job-titles', { title, active });
    return res.data;
  },
  update: async (id: number, data: Partial<JobTitle>) => {
    const res = await api.put<JobTitle>(`/job-titles/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/job-titles/${id}`);
  },
};

export const resumesApi = {
  list: async () => {
    const res = await api.get<Resume[]>('/resumes');
    return res.data;
  },
  upload: async (formData: FormData) => {
    const res = await api.post<Resume>('/resumes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  update: async (id: number, data: { title?: string; active?: boolean; job_title_ids?: number[] }) => {
    const res = await api.put<Resume>(`/resumes/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/resumes/${id}`);
  },
  download: async (id: number) => {
    const res = await api.get<Blob>(`/resumes/${id}/download`, { responseType: 'blob' });
    return res.data;
  },
  downloadUrl: (id: number) => `${API_BASE_URL}/resumes/${id}/download`,
};

export const jobsApi = {
  list: async (params?: { query?: string; source?: string; page?: number; limit?: number }) => {
    const res = await api.get<JobPagination>('/jobs', { params });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<Job>(`/jobs/${id}`);
    return res.data;
  },
  analyze: async (id: number) => {
    const res = await api.post<JobAnalyzeResponse>(`/jobs/${id}/analyze`);
    return res.data;
  },
  generateCoverLetter: async (id: number, data?: { job_id?: number; job_title_id?: number; resume_id?: number; custom_instructions?: string }) => {
    const res = await api.post<CoverLetter>(`/jobs/${id}/generate-cover-letter`, {
      job_id: id,
      ...data,
    });
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/jobs/${id}`);
  },
};

export const llmApi = {
  list: async () => {
    const res = await api.get<LLMProvider[]>('/llm-providers');
    return res.data;
  },
  create: async (data: { provider: string; api_key: string; model: string; priority: number; active: boolean; enabled: boolean }) => {
    const res = await api.post<LLMProvider>('/llm-providers', data);
    return res.data;
  },
  update: async (id: number, data: Partial<LLMProvider> & { api_key?: string }) => {
    const res = await api.put<LLMProvider>(`/llm-providers/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/llm-providers/${id}`);
  },
  test: async (id: number) => {
    const res = await api.post<{ success: boolean; response?: string; error?: string }>(`/llm-providers/${id}/test`, {});
    return res.data;
  },
};

export const hrContactsApi = {
  list: async () => {
    const res = await api.get<HRContact[]>('/hr-contacts');
    return res.data;
  },
  listRequiredJobs: async () => {
    const res = await api.get<Job[]>('/hr-contacts/required-jobs');
    return res.data;
  },
  create: async (data: { job_id: number; company?: string; contact_name?: string; email: string; phone?: string; notes?: string }) => {
    const res = await api.post<HRContact>('/hr-contacts', data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/hr-contacts/${id}`);
  },
};

export const emailApi = {
  getSettings: async () => {
    const res = await api.get<EmailSettings | null>('/email-settings');
    return res.data;
  },
  updateSettings: async (data: Partial<EmailSettings> & { smtp_password?: string }) => {
    const res = await api.put<EmailSettings>('/email-settings', data);
    return res.data;
  },
  testConnection: async () => {
    const res = await api.post<{ success: boolean; message: string; error?: string }>('/email-settings/test');
    return res.data;
  },
};

export const applicationsApi = {
  list: async (status?: string) => {
    const res = await api.get<Application[]>('/applications', { params: { status } });
    return res.data;
  },
  get: async (id: number) => {
    const res = await api.get<Application>(`/applications/${id}`);
    return res.data;
  },
  create: async (data: { job_id: number; resume_id?: number; cover_letter_id?: number; hr_contact_id?: number; email_subject?: string; notes?: string; cover_letter_content?: string }) => {
    const res = await api.post<Application>('/applications', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Omit<Application, 'resume_id'>> & { resume_id?: number | null; cover_letter_content?: string }) => {
    const res = await api.put<Application>(`/applications/${id}`, data);
    return res.data;
  },
  preview: async (id: number) => {
    const res = await api.get<ApplicationPreview>(`/applications/${id}/preview`);
    return res.data;
  },
  send: async (id: number) => {
    const res = await api.post<Application>(`/applications/${id}/send`);
    return res.data;
  },
  getDashboardStats: async () => {
    const res = await api.get<DashboardStats>('/dashboard-stats');
    return res.data;
  },
};

export const autoApplyApi = {
  run: async (data: { source: string; search_query: string; page?: number; limit?: number }) => {
    const res = await api.post<{
      source: string;
      query: string;
      total_processed: number;
      applied_count: number;
      ready_count: number;
      hr_required_count: number;
      jobs: Array<{
        job_id: number;
        title: string;
        company: string;
        hr_email?: string;
        matched_title?: string;
        resume_used?: string;
        status: string;
        message: string;
      }>;
    }>('/auto-apply', data);
    return res.data;
  },
};

export const followUpsApi = {
  list: async (applicationId: number) => {
    const res = await api.get<ApplicationFollowUp[]>('/applications/' + applicationId + '/follow-ups');
    return res.data;
  },
  send: async (applicationId: number, data: { request_id: string; subject: string; body: string; attach_resume: boolean }) => {
    const res = await api.post<ApplicationFollowUp>('/applications/' + applicationId + '/follow-ups', data);
    return res.data;
  },
};
