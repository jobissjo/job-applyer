import { TableSkeleton } from '../components/ListSkeleton';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, AlertTriangle, Plus, ExternalLink, ArrowRight, Trash2 } from 'lucide-react';
import { hrContactsApi, jobsApi } from '../services/api';
import { Job, HRContact } from '../types';

export const HRContacts: React.FC = () => {
  const [requiredJobs, setRequiredJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<HRContact[]>([]);
  const [activeTab, setActiveTab] = useState<'required' | 'saved'>('required');

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [deletingJob, setDeletingJob] = useState(false);
  const [hrEmail, setHrEmail] = useState('');
  const [hrName, setHrName] = useState('');
  const [hrPhone, setHrPhone] = useState('');
  const [hrNotes, setHrNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [req, saved] = await Promise.all([
        hrContactsApi.listRequiredJobs(),
        hrContactsApi.list(),
      ]);
      setRequiredJobs(req);
      setContacts(saved);
    } catch (err) {
      setMessage({ type: 'error', text: 'Could not load recruiter contacts. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = (job: Job) => {
    setSelectedJob(job);
    setHrEmail('');
    setHrName('');
    setHrPhone('');
    setHrNotes('');
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !hrEmail) return;

    setSubmitting(true);
    setMessage(null);
    try {
      await hrContactsApi.create({
        job_id: selectedJob.id,
        company: selectedJob.company,
        contact_name: hrName || undefined,
        email: hrEmail.trim(),
        phone: hrPhone || undefined,
        notes: hrNotes || undefined,
      });
      setMessage({
        type: 'success',
        text: `HR Contact saved for ${selectedJob.company}. The job is now eligible for application!`,
      });
      setSelectedJob(null);
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to save HR contact' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (!window.confirm('Delete this HR contact?')) return;
    try {
      await hrContactsApi.delete(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return;
    setDeletingJob(true);
    setMessage(null);
    try {
      await jobsApi.delete(jobToDelete.id);
      setMessage({
        type: 'success',
        text: `Job "${jobToDelete.title}" at ${jobToDelete.company} has been removed.`,
      });
      setJobToDelete(null);
      fetchData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to delete job listing',
      });
    } finally {
      setDeletingJob(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div className="page-intro"><span className="eyebrow">Keep your applications moving</span><h1>Recruiter contacts</h1><p>Add missing recruiter emails and keep your saved contacts in one place.</p></div>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('required')}
          className={`btn ${activeTab === 'required' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <AlertTriangle size={16} /> Pending HR Contacts ({requiredJobs.length})
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`btn ${activeTab === 'saved' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <UserCheck size={16} /> Saved Contacts ({contacts.length})
        </button>
      </div>

      {/* Tab: Required Jobs */}
      {activeTab === 'required' && (
        <div className="card">
          <div className="card-title">Jobs Missing Recruiter Email</div>
          <div className="card-subtitle">
            These jobs were scraped without an explicit contact email. Research the company's careers portal or LinkedIn to find recruiter contact info.
          </div>

          {loading ? <TableSkeleton columns={["Job Title", "Company", "Source", "Portal Link", "Date Scraped", "Actions"]} label="Loading jobs missing recruiter emails…" /> : requiredJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <UserCheck size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              <p>Awesome! All scraped jobs currently have HR emails configured.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Job Title</th>
                    <th>Company</th>
                    <th>Source</th>
                    <th>Portal Link</th>
                    <th>Date Scraped</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requiredJobs.map((j) => (
                    <tr key={j.id}>
                      <td style={{ fontWeight: 600 }}>{j.title}</td>
                      <td>{j.company}</td>
                      <td>
                        <span className="badge badge-source">{j.source.toUpperCase()}</span>
                      </td>
                      <td>
                        <a
                          href={j.detail_url || j.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                        >
                          View Listing <ExternalLink size={12} />
                        </a>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(j.scraped_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenAddModal(j)}
                            className="btn btn-primary btn-sm"
                          >
                            <Plus size={14} /> Add HR Contact
                          </button>
                          <Link to={`/jobs/${j.id}`} className="btn btn-secondary btn-sm">
                            Open Job <ArrowRight size={14} />
                          </Link>
                          <button
                            onClick={() => setJobToDelete(j)}
                            className="btn btn-danger btn-sm"
                            title="Delete Job Listing"
                            style={{
                              padding: '6px 10px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: 'var(--accent-red)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Saved Contacts */}
      {activeTab === 'saved' && (
        <div className="card">
          <div className="card-title">Saved recruiter contacts</div>
          <div className="card-subtitle">
            Recruiter and HR email addresses linked to specific job opportunities.
          </div>

          {loading ? <TableSkeleton columns={["Company", "Recruiter Name", "Email", "Phone", "Source", "Added On", "Actions"]} label="Loading saved contacts…" /> : contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No HR contacts saved manually yet.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Recruiter Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Source</th>
                    <th>Added On</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.company || 'Company'}</td>
                      <td>{c.contact_name || 'HR Team'}</td>
                      <td style={{ color: 'var(--accent-cyan)', fontWeight: 500 }}>{c.email}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.phone || 'N/A'}</td>
                      <td>
                        <span className="badge badge-source">{c.source}</span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
                          className="btn btn-danger btn-sm"
                          title="Delete Contact"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add HR Contact */}
      {selectedJob && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-title">Add HR Contact for Job</div>
            <p className="card-subtitle">
              Provide recruiter contact info for <strong>{selectedJob.title}</strong> at{' '}
              <strong>{selectedJob.company}</strong>.
            </p>

            <form onSubmit={handleSaveContact}>
              <div className="form-group">
                <label className="form-label">HR / Recruiter Email *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="recruiter@company.com"
                  value={hrEmail}
                  onChange={(e) => setHrEmail(e.target.value)}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Contact Name (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sarah Jenkins"
                    value={hrName}
                    onChange={(e) => setHrName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="+91 9876543210"
                    value={hrPhone}
                    onChange={(e) => setHrPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '80px' }}
                  placeholder="Notes about the recruiter, referral details, or job post link..."
                  value={hrNotes}
                  onChange={(e) => setHrNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Save & Enable Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Job Confirmation */}
      {jobToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-red)',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Delete Job Listing
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  This action cannot be undone
                </div>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to permanently delete this job listing? It will be removed from your missing HR contacts queue and all associated drafts will be deleted.
            </p>

            <div
              style={{
                background: 'var(--bg-input)',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '24px',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                {jobToDelete.title}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '3px' }}>
                {jobToDelete.company} • <span className="badge badge-source">{jobToDelete.source.toUpperCase()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setJobToDelete(null)}
                disabled={deletingJob}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteJob}
                disabled={deletingJob}
                className="btn btn-danger"
                style={{
                  background: 'var(--accent-rose)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                {deletingJob ? 'Deleting...' : 'Yes, Delete Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
