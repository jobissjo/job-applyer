import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Mail,
  Building,
  ArrowRight,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { autoApplyApi } from '../services/api';

export const AutoApply: React.FC = () => {
  const [source, setSource] = useState('technopark');
  const [query, setQuery] = useState('python');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState('');

  const handleStartPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError('');
    setReport(null);

    try {
      const data = await autoApplyApi.run({
        source,
        search_query: query.trim() || 'python',
        page,
        limit,
      });
      setReport(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Pipeline execution failed. Check backend logs.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Automated Job Apply Pipeline
          </h1>
          <span className="badge badge-ready" style={{ textTransform: 'uppercase' }}>
            <Zap size={14} /> Full Automation
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Execute the end-to-end pipeline: searches live listings, navigates to details pages, extracts recruiter emails, matches your target roles, synthesizes tailored resumes if none exist, writes custom cover letters, and applies.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Pipeline Config Form */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-title">Configure Automation Run</div>
        <div className="card-subtitle">
          Specify search keyword, source portal, and batch size.
        </div>

        <form onSubmit={handleStartPipeline}>
          <div className="grid-4" style={{ marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Job Portal</label>
              <select
                className="form-select"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="technopark">Technopark (technopark.in)</option>
                <option value="infopark">Infopark (infopark.in)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Search Query *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. python, fastapi, react..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Page Number</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Number of Jobs (Limit)</label>
              <input
                type="number"
                min={1}
                max={20}
                className="form-input"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={running}
            className="btn btn-primary"
            style={{
              padding: '12px 24px',
              fontSize: '1rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            }}
          >
            {running ? (
              <>
                <Loader2 size={18} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                Executing Pipeline (Navigating & Applying)...
              </>
            ) : (
              <>
                <Play size={18} /> Start Automated Pipeline
              </>
            )}
          </button>
        </form>
      </div>

      {/* Pipeline Report */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Metrics summary */}
          <div className="grid-4">
            <div className="stat-card">
              <span className="stat-label">Jobs Processed</span>
              <div className="stat-value">{report.total_processed}</div>
            </div>

            <div className="stat-card">
              <span className="stat-label">Applications Sent</span>
              <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
                {report.applied_count}
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-label">Prepared & Ready</span>
              <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
                {report.ready_count}
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-label">HR Contact Required</span>
              <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
                {report.hr_required_count}
              </div>
            </div>
          </div>

          {/* Job execution details */}
          <div className="card">
            <div className="card-title">Processed Opportunities & Outgoing Status</div>
            <div className="card-subtitle">
              Each job was fetched from its details page, matched, and paired with a resume & cover letter.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {report.jobs.map((j: any, i: number) => (
                <div
                  key={j.job_id || i}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                        {j.title}
                      </h3>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        {j.company} • Matched Role:{' '}
                        <strong style={{ color: 'var(--text-main)' }}>{j.matched_title}</strong>
                      </div>
                    </div>

                    <span
                      className={`badge ${
                        j.status === 'sent'
                          ? 'badge-sent'
                          : j.status === 'ready'
                          ? 'badge-ready'
                          : 'badge-hr_contact_required'
                      }`}
                    >
                      {j.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', fontSize: '0.84rem', color: 'var(--text-sub)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} color="var(--primary)" /> HR Email:{' '}
                      <strong style={{ color: j.hr_email ? 'var(--accent-cyan)' : 'var(--accent-amber)' }}>
                        {j.hr_email || 'None on page'}
                      </strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={14} color="var(--primary)" /> Resume:{' '}
                      <strong style={{ color: 'var(--text-main)' }}>{j.resume_used}</strong>
                    </span>
                  </div>

                  <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                    {j.message}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                    <Link to={`/jobs/${j.job_id}`} className="btn btn-secondary btn-sm">
                      Inspect Job Details <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
