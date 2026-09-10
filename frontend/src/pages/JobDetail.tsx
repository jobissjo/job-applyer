import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  Send,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  Building,
  MapPin,
  Calendar,
  Mail,
  Edit3,
} from 'lucide-react';
import { jobsApi, resumesApi, applicationsApi, hrContactsApi, formatApiError } from '../services/api';
import { Job, JobAnalyzeResponse, Resume, CoverLetter, Application } from '../types';

export const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const jobId = Number(id);

  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [analysis, setAnalysis] = useState<JobAnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [selectedResumeId, setSelectedResumeId] = useState<number | undefined>();
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [generatingCL, setGeneratingCL] = useState(false);

  const [hrEmail, setHrEmail] = useState<string>('');
  const [hrName, setHrName] = useState<string>('');
  const [showAddHrModal, setShowAddHrModal] = useState(false);

  const [subject, setSubject] = useState<string>('');
  const [application, setApplication] = useState<Application | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!jobId) return;
    jobsApi
      .get(jobId)
      .then((data) => {
        setJob(data);
        if (data.contact_email) {
          setHrEmail(data.contact_email);
        }
        setSubject(`Application for ${data.title}`);
      })
      .catch((err) => console.error(err));

    resumesApi.list().then(setResumes).catch(console.error);
  }, [jobId]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setActionMessage(null);
    try {
      const res = await jobsApi.analyze(jobId);
      setAnalysis(res);
      if (res.recommended_resume_id) {
        setSelectedResumeId(res.recommended_resume_id);
      }
      if (res.hr_email) {
        setHrEmail(res.hr_email);
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: formatApiError(err, 'Failed to analyze job with configured LLM.'),
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    setGeneratingCL(true);
    setActionMessage(null);
    try {
      const res = await jobsApi.generateCoverLetter(jobId, {
        job_id: jobId,
        job_title_id: analysis?.job_title_id,
        resume_id: selectedResumeId,
      });
      setCoverLetter(res.content);
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: formatApiError(err, 'Failed to generate cover letter with configured LLM.'),
      });
    } finally {
      setGeneratingCL(false);
    }
  };

  const handleSaveHrContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hrEmail) return;
    try {
      await hrContactsApi.create({
        job_id: jobId,
        company: job?.company,
        contact_name: hrName,
        email: hrEmail,
      });
      setShowAddHrModal(false);
      setActionMessage({ type: 'success', text: 'HR contact saved successfully. Application can now be sent!' });
      // Refresh job data
      const updated = await jobsApi.get(jobId);
      setJob(updated);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: formatApiError(err, 'Failed to save HR contact') });
    }
  };

  const handlePrepareApplication = async () => {
    try {
      const app = await applicationsApi.create({
        job_id: jobId,
        resume_id: selectedResumeId,
        email_subject: subject,
        notes: coverLetter,
      });
      setApplication(app);
      setShowPreviewModal(true);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: formatApiError(err, 'Failed to prepare application') });
    }
  };

  const handleSendApplication = async () => {
    if (!application) return;
    setSending(true);
    setActionMessage(null);
    try {
      await applicationsApi.send(application.id);
      setShowPreviewModal(false);
      setActionMessage({ type: 'success', text: 'Application sent successfully via SMTP!' });
      // Refresh
      const updatedJob = await jobsApi.get(jobId);
      setJob(updatedJob);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: formatApiError(err, 'Failed to send application email') });
    } finally {
      setSending(false);
    }
  };

  if (!job) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>Loading job details...</div>;
  }

  const effectiveHrEmail = hrEmail || job.contact_email;

  return (
    <div>
      {/* Header Banner */}
      <div style={{ marginBottom: '24px' }}>
        <Link to="/jobs" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'inline-block' }}>
          ← Back to all jobs
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{job.title}</h1>
              <span className="badge badge-source">{job.source.toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', gap: '20px', color: 'var(--text-muted)', fontSize: '0.92rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building size={16} /> {job.company}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} /> {job.location || 'Kerala'}
              </span>
              {job.posted_date && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} /> {job.posted_date}
                </span>
              )}
            </div>
          </div>

          <a href={job.detail_url || job.job_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Original Portal Listing <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {actionMessage && (
        <div className={`alert alert-${actionMessage.type === 'success' ? 'success' : 'danger'}`}>
          {actionMessage.text}
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Left Column: Job Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <div className="card-title">Job Description</div>
            <div style={{ whiteSpace: 'pre-line', color: 'var(--text-main)', fontSize: '0.94rem', lineHeight: 1.6 }}>
              {job.description || 'No detailed description provided.'}
            </div>

            {job.requirements && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <div className="card-title" style={{ fontSize: '1.1rem' }}>Requirements & Skills</div>
                <div style={{ whiteSpace: 'pre-line', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {job.requirements}
                </div>
              </div>
            )}
          </div>

          {/* Contact Information Box */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} /> Recruiter & HR Contact
            </div>

            {effectiveHrEmail ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                <CheckCircle2 color="var(--accent-green)" size={20} />
                <div>
                  <div style={{ fontWeight: 600, color: '#34d399' }}>{effectiveHrEmail}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready for application dispatch</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
                  <AlertTriangle size={20} />
                  <div>
                    <div style={{ fontWeight: 600 }}>HR Contact Required</div>
                    <div style={{ fontSize: '0.82rem' }}>This job does not have an HR email. Applications cannot be dispatched until an email is provided.</div>
                  </div>
                </div>
                <button onClick={() => setShowAddHrModal(true)} className="btn btn-secondary btn-sm">
                  + Add HR Contact Email
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Matching & Application Action Center */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Step 1: AI Matcher */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>1. AI Job Title Matcher</div>
              <button onClick={handleAnalyze} disabled={analyzing} className="btn btn-primary btn-sm">
                <Sparkles size={14} /> {analyzing ? 'Analyzing with LLM...' : 'Analyze Match'}
              </button>
            </div>
            <div className="card-subtitle">
              Evaluates job requirements against your configured job title preferences using LLM failover.
            </div>

            {analysis && (
              <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {analysis.matched ? `Matched: ${analysis.job_title}` : 'No Direct Title Match'}
                  </span>
                  <span className={`badge ${analysis.match_score >= 70 ? 'badge-matched' : 'badge-hr_contact_required'}`}>
                    Score: {analysis.match_score}%
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {analysis.reason}
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Resume Selector */}
          <div className="card">
            <div className="card-title">2. Select Resume to Attach</div>
            <div className="card-subtitle">
              Automatically mapped from matched title, or override manually.
            </div>

            <div className="form-group">
              <select
                className="form-select"
                value={selectedResumeId || ''}
                onChange={(e) => setSelectedResumeId(Number(e.target.value) || undefined)}
              >
                <option value="">-- Choose Resume --</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.file_name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: Cover Letter Generator */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>3. Tailored Cover Letter</div>
              <button
                onClick={handleGenerateCoverLetter}
                disabled={generatingCL}
                className="btn btn-primary btn-sm"
              >
                <Edit3 size={14} /> {generatingCL ? 'Writing Letter...' : 'Generate with LLM'}
              </button>
            </div>
            <div className="card-subtitle">
              Generates a concise, professional cover letter tailored to this role and your background.
            </div>

            <textarea
              className="form-textarea"
              placeholder="Your generated cover letter will appear here. You can edit before sending..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={8}
            />
          </div>

          {/* Step 4: Application Preparation & Dispatch */}
          <div className="card" style={{ border: '1px solid var(--primary)' }}>
            <div className="card-title">4. Review & Dispatch</div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Every application requires explicit human review and a valid HR contact. Never auto-sent.
            </p>

            <button
              onClick={handlePrepareApplication}
              disabled={!effectiveHrEmail}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
            >
              <Send size={18} /> Review & Prepare Application
            </button>

            {!effectiveHrEmail && (
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', marginTop: '8px', textAlign: 'center' }}>
                Cannot send: Please add an HR contact email first.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add HR Contact */}
      {showAddHrModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-title">Add HR / Recruiter Contact</div>
            <p className="card-subtitle">
              Enter recruiter contact details for <strong>{job.company}</strong> to enable email sending.
            </p>

            <form onSubmit={handleSaveHrContact}>
              <div className="form-group">
                <label className="form-label">HR Contact Email *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="careers@company.com"
                  value={hrEmail}
                  onChange={(e) => setHrEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact / Recruiter Name (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Jane Doe"
                  value={hrName}
                  onChange={(e) => setHrName(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowAddHrModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Application Preview & Send Confirmation */}
      {showPreviewModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <div className="card-title">Preview Application Before Sending</div>
            <p className="card-subtitle">
              Please inspect the email headers, attachment, and cover letter before dispatching via SMTP.
            </p>

            <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '8px', fontSize: '0.88rem' }}>
                <strong style={{ color: 'var(--text-muted)' }}>To:</strong> {effectiveHrEmail}
              </div>
              <div style={{ marginBottom: '8px', fontSize: '0.88rem' }}>
                <strong style={{ color: 'var(--text-muted)' }}>Subject:</strong> {subject}
              </div>
              <div style={{ fontSize: '0.88rem' }}>
                <strong style={{ color: 'var(--text-muted)' }}>Attached Resume:</strong>{' '}
                {resumes.find((r) => r.id === selectedResumeId)?.file_name || 'None selected'}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Cover Letter Body</label>
              <textarea
                className="form-textarea"
                rows={10}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="btn btn-secondary"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleSendApplication}
                disabled={sending}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                <Send size={16} /> {sending ? 'Sending via SMTP...' : 'Confirm & Send Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
