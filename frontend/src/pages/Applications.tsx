import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, AlertTriangle, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { applicationsApi } from '../services/api';
import { Application } from '../types';

export const Applications: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const data = await applicationsApi.list(filterStatus || undefined);
      setApplications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [filterStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="badge badge-sent"><CheckCircle2 size={12} /> Sent</span>;
      case 'ready':
        return <span className="badge badge-ready"><CheckCircle2 size={12} /> Ready to Send</span>;
      case 'hr_contact_required':
        return <span className="badge badge-hr_contact_required"><AlertTriangle size={12} /> HR Required</span>;
      case 'failed':
        return <span className="badge badge-failed"><XCircle size={12} /> Failed</span>;
      default:
        return <span className="badge badge-new"><Clock size={12} /> {status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Application History
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Track every job application from draft to final email dispatch.
          </p>
        </div>

        {/* Status Filter */}
        <div style={{ width: '200px' }}>
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ready">Ready to Send</option>
            <option value="sent">Sent</option>
            <option value="hr_contact_required">HR Contact Required</option>
            <option value="failed">Failed</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading applications...
          </div>
        ) : applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <Send size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p>No applications found.</p>
            <Link to="/jobs" className="btn btn-primary btn-sm" style={{ marginTop: '16px' }}>
              Discover Jobs to Apply
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Company</th>
                  <th>Resume</th>
                  <th>HR Recruiter Email</th>
                  <th>Status</th>
                  <th>Applied / Sent Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 600 }}>{app.job?.title || 'Job'}</td>
                    <td>{app.job?.company || 'Company'}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {app.resume?.title || 'No resume selected'}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {app.sent_to || app.hr_contact?.email || app.job?.contact_email || (
                        <span style={{ color: 'var(--accent-amber)' }}>Missing HR Email</span>
                      )}
                    </td>
                    <td>{getStatusBadge(app.status)}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {app.sent_at
                        ? new Date(app.sent_at).toLocaleDateString()
                        : new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/applications/${app.id}`} className="btn btn-secondary btn-sm">
                        Review & Send <ArrowRight size={14} />
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
