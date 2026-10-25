import { api } from './api';
import type { Application } from '../types';

export const progressLabels = {
  awaiting_response: 'Awaiting response', callback_received: 'Callback received',
  interviewing: 'Interviewing', selected: 'Selected', not_selected: 'Not selected', withdrawn: 'Withdrawn',
};
export type HiringProgress = keyof typeof progressLabels;
export const roundStatusLabels = { to_schedule: 'To schedule', scheduled: 'Scheduled', completed: 'Completed', missed: 'Missed', cancelled: 'Cancelled' };
export const resultLabels = { awaiting_result: 'Awaiting result', passed: 'Passed', not_passed: 'Not passed' };
export const modeLabels = { online: 'Online', phone: 'Phone', in_person: 'In person', other: 'Other' };
export const noteLabels = {
  preparation_notes: 'Preparation notes', reflection: 'How did my interview go?',
  went_wrong: 'What went wrong?', feedback: 'Feedback received', improvements: 'What to improve next time',
};
export interface RoundInput {
  name: string;
  scheduled_at: string | null;
  mode: keyof typeof modeLabels;
  location: string;
  contact: string;
  status: keyof typeof roundStatusLabels;
  result: keyof typeof resultLabels;
  preparation_notes: string;
  reflection: string;
  went_wrong: string;
  feedback: string;
  improvements: string;
}
export interface InterviewRound extends RoundInput { id: number; created_at: string; updated_at: string }
export interface InterviewChange { id: number; round_id: number | null; description: string; before: Record<string, unknown>; after: Record<string, unknown>; created_at: string }
export interface InterviewTracking { application: Application; rounds: InterviewRound[]; history: InterviewChange[] }
export const emptyRound: RoundInput = {
  name: '', scheduled_at: null, mode: 'online', location: '', contact: '', status: 'to_schedule', result: 'awaiting_result',
  preparation_notes: '', reflection: '', went_wrong: '', feedback: '', improvements: '',
};
export const interviewsApi = {
  list: async () => (await api.get<InterviewTracking[]>('/interviews')).data,
  get: async (id: number) => (await api.get<InterviewTracking>(`/applications/${id}/interviews`)).data,
  progress: async (id: number, progress: HiringProgress) => (await api.patch<InterviewTracking>(`/applications/${id}/hiring-progress`, { progress })).data,
  saveRound: async (id: number, data: RoundInput, roundId?: number) => {
    const url = `/applications/${id}/interviews`;
    return (roundId === undefined ? await api.post<InterviewTracking>(url, data) : await api.put<InterviewTracking>(`${url}/${roundId}`, data)).data;
  },
};
export function utcDate(value: string) { return new Date(/(Z|[+-]\d\d:\d\d)$/i.test(value) ? value : value + 'Z'); }
export function localInterviewDate(value: string | null) {
  if (!value) return '';
  const date = utcDate(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function interviewISO(value: string) {
  if (!value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter date and time as YYYY-MM-DDTHH:mm.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || localInterviewDate(date.toISOString()) !== value) throw new Error('Choose a valid local date and time.');
  return date.toISOString();
}
export function roundNeedsUpdate(round: InterviewRound, now = Date.now()) {
  return round.status === 'scheduled' && !!round.scheduled_at && utcDate(round.scheduled_at).getTime() < now;
}
export function nextInterview(rounds: InterviewRound[], now = Date.now()) {
  return rounds.filter(r => r.status === 'scheduled' && r.scheduled_at && utcDate(r.scheduled_at).getTime() >= now)
    .sort((a, b) => utcDate(a.scheduled_at!).getTime() - utcDate(b.scheduled_at!).getTime())[0];
}
export const trackingFilters = { all: 'All tracked', upcoming: 'Upcoming interviews', needs_update: 'Needs update', awaiting_result: 'Awaiting results', ...progressLabels };
export type TrackingFilter = keyof typeof trackingFilters;
export function matchesTracking(item: InterviewTracking, filter: TrackingFilter, now = Date.now()) {
  if (filter === 'all') return true;
  if (filter === 'upcoming') return !!nextInterview(item.rounds, now);
  if (filter === 'needs_update') return item.rounds.some(r => roundNeedsUpdate(r, now));
  if (filter === 'awaiting_result') return item.rounds.some(r => r.status === 'completed' && r.result === 'awaiting_result');
  return item.application.hiring_progress === filter;
}
export function historyValue(key: string, value: unknown): string {
  if (value === null || value === '') return 'Not recorded';
  if (key === 'scheduled_at') return utcDate(String(value)).toLocaleString();
  const labels: Record<string, string> = { ...progressLabels, ...roundStatusLabels, ...resultLabels, ...modeLabels };
  return labels[String(value)] || String(value);
}
export function historyChanges(change: InterviewChange) {
  return Object.keys(change.after).filter(k => change.before[k] !== change.after[k]);
}
