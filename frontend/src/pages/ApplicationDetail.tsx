import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Mail,
  Building,
  Save,
  ArrowLeft,
  XCircle,
} from 'lucide-react';
import { applicationsApi, resumesApi } from '../services/api';
import { Application, Resume } from '../types';

export const ApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const appId = Number(id);

  const [application, setApplication] = useState<Application | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<number | undefined>();
  const [subject, setSubject] = useState('');
  const [coverLetterContent, setCoverLetterContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAppData = async () => {
    try {
      const [app, resList] = await Promise.all([
        applicationsApi.get(appId),
        resumesApi.list(),
      ]);
      setApplication(app);
      setResumes(resList);
      setSelectedResumeId(app.resume_id || undefined);
      setSubject(app.email_subject || `Application for ${app.job?.title || 'Job'}`);
      setCoverLetterContent(app.cover_letter?.content || app.notes || '');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (appId) fetchAppData();
  }, [appId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await applicationsApi.update(appId, {
        resume_id: selectedResumeId,
        email_subject: subject,
        notes: coverLetterContent,
      });
      setApplication(updated);
      setMessage({ type: 'success', text: 'Application details updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to update application' });
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!window.confirm('Are you sure you want to send this application email right now?')) return;
    setSending(true);
    setMessage(null);
    try {
      const updated = await applicationsApi.send(appId);
      setApplication(updated);
      setMessage({ type: 'success', text: `Application successfully sent to ${updated.sent_to}!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to send application email' });
    } finally {
      setSending(false);
    }
  };

  if (!application) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>Loading application details...</div>;
  }

  const effectiveEmail =
    application.sent_to ||
    application.hr_contact?.email ||
    application.job?.contact_email;

  const canSend = Boolean(effectiveEmail) && application.status !== 'sent';

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link to="/applications" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          <ArrowLeft size={14} /> Back to Applications
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Application Review
              </h1>
              <span className={`badge badge-${application.status}`}>{application.status.toUpperCase()}</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              {application.job?.title} at {application.job?.company}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleSave} disabled={saving} className="btn btn-secondary">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              <Send size={16} /> {sending ? 'Sending...' : 'Send Application Now'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'}`}>
          {message.text}
        </div>
      )}

      {application.status === 'sent' && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <div>
            <strong>Dispatched:</strong> This application was sent to <strong>{application.sent_to}</strong> on{' '}
            {application.sent_at ? new Date(application.sent_at).toLocaleString() : 'recently'}.
          </div>
        </div>
      )}

      {!effectiveEmail && (
        <div className="alert alert-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>HR Contact Required:</strong> No recruiter or HR email is attached to this application. It cannot be dispatched until an HR email is provided.
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Left Column: Email Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <div className="card-title">Recipient & Subject</div>

            <div className="form-group">
              <label className="form-label">To (HR / Recruiter Email)</label>
              <input
                type="email"
                className="form-input"
                readOnly
                value={effectiveEmail || 'No HR email found'}
                style={{ opacity: 0.8 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Subject Line</label>
              <input
                type="text"
                className="form-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Attached Resume</label>
              <select
                className="form-select"
                value={selectedResumeId || ''}
                onChange={(e) => setSelectedResumeId(Number(e.target.value) || undefined)}
              >
                <option value="">-- No Resume Attached --</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.file_name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Target Job Summary</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div><strong>Role:</strong> {application.job?.title}</div>
              <div><strong>Company:</strong> {application.job?.company}</div>
              <div><strong>Location:</strong> {application.job?.location || 'Kerala'}</div>
              <div><strong>Source:</strong> {application.job?.source.toUpperCase()}</div>
              {application.job?.detail_url && (
                <div style={{ marginTop: '10px' }}>
                  <a
                    href={application.job.detail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    View Original Portal Post ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cover Letter Body */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title">Cover Letter Body (Email Message)</div>
          <div className="card-subtitle">
            This content will be placed directly into the outgoing email body sent via your SMTP settings.
          </div>

          <textarea
            className="form-textarea"
            style={{ flex: 1, minHeight: '360px', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.5 }}
            value={coverLetterContent}
            onChange={(e) => setCoverLetterContent(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
