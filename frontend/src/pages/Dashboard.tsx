import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Send,
  AlertTriangle,
  UserCheck,
  XCircle,
  ArrowUpRight,
  PlusCircle,
  FileText,
  Search,
} from 'lucide-react';
import { applicationsApi } from '../services/api';
import { DashboardStats, Application } from '../types';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      applicationsApi.getDashboardStats(),
      applicationsApi.list()
    ])
      .then(([s, apps]) => {
        setStats(s);
        setRecentApps(apps.slice(0, 5));
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="badge badge-sent">Sent</span>;
      case 'ready':
        return <span className="badge badge-ready">Ready</span>;
      case 'hr_contact_required':
        return <span className="badge badge-hr_contact_required">HR Contact Required</span>;
      case 'failed':
        return <span className="badge badge-failed">Failed</span>;
      default:
        return <span className="badge badge-new">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Overview
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Real-time metrics for your local job discovery and application pipelines.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Total Scraped Jobs</span>
            <Briefcase size={20} color="var(--primary)" />
          </div>
          <div className="stat-value">{stats?.total_jobs ?? 0}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Applications Ready</span>
            <Send size={20} color="var(--accent-cyan)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            {stats?.applications_ready ?? 0}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Applications Sent</span>
            <Send size={20} color="var(--accent-green)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
            {stats?.applications_sent ?? 0}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">HR Contact Required</span>
            <AlertTriangle size={20} color="var(--accent-amber)" />
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
            {stats?.hr_contacts_required ?? 0}
          </div>
        </div>
      </div>

      {/* Quick Setup Actions */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-title">Quick Actions & Setup Workflow</div>
        <div className="card-subtitle">
          Follow the 4-step setup flow to start automatically matching and dispatching job applications.
        </div>

        <div className="grid-4">
          <Link to="/job-titles" className="card" style={{ padding: '16px', borderStyle: 'dashed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <PlusCircle size={18} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>1. Desired Titles</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Add target roles like 'Python Developer' or 'FastAPI Engineer'.
            </p>
          </Link>

          <Link to="/resumes" className="card" style={{ padding: '16px', borderStyle: 'dashed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <FileText size={18} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>2. Upload Resumes</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Upload PDF/DOCX resumes and map them to configured titles.
            </p>
          </Link>

          <Link to="/llm-providers" className="card" style={{ padding: '16px', borderStyle: 'dashed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <ArrowUpRight size={18} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>3. LLM Failover</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Set up OpenRouter, Groq, or Gemini keys for resilient generation.
            </p>
          </Link>

          <Link to="/jobs" className="card" style={{ padding: '16px', borderStyle: 'dashed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Search size={18} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>4. Discover & Apply</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Analyze jobs, generate tailored letters, and review before send.
            </p>
          </Link>
        </div>
      </div>

      {/* Recent Applications Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div className="card-title">Recent Applications</div>
            <div className="card-subtitle" style={{ marginBottom: 0 }}>
              Recent jobs you analyzed, prepared, or sent.
            </div>
          </div>
          <Link to="/applications" className="btn btn-secondary btn-sm">
            View All Applications <ArrowUpRight size={14} />
          </Link>
        </div>

        {recentApps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            No applications recorded yet. Search for a job and click "Prepare Application".
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Sent To</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map((app) => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 600 }}>{app.job?.title || 'Job'}</td>
                    <td>{app.job?.company || 'Company'}</td>
                    <td>{getStatusBadge(app.status)}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {app.sent_to || app.hr_contact?.email || app.job?.contact_email || 'None'}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/applications/${app.id}`} className="btn btn-secondary btn-sm">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
