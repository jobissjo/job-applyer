import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, AlertTriangle, Plus, ExternalLink, ArrowRight, Trash2 } from 'lucide-react';
import { hrContactsApi } from '../services/api';
import { Job, HRContact } from '../types';

export const HRContacts: React.FC = () => {
  const [requiredJobs, setRequiredJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<HRContact[]>([]);
  const [activeTab, setActiveTab] = useState<'required' | 'saved'>('required');

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [hrEmail, setHrEmail] = useState('');
  const [hrName, setHrName] = useState('');
  const [hrPhone, setHrPhone] = useState('');
  const [hrNotes, setHrNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [req, saved] = await Promise.all([
        hrContactsApi.listRequiredJobs(),
        hrContactsApi.list(),
      ]);
      setRequiredJobs(req);
      setContacts(saved);
    } catch (err) {
      console.error(err);
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

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
          HR Contacts Required
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Jobs without a verified HR or recruiter email cannot be automatically sent. Add an HR email here to unlock application preparation.
        </p>
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

          {requiredJobs.length === 0 ? (
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
          <div className="card-title">Saved HR Contacts Directory</div>
          <div className="card-subtitle">
            Recruiter and HR email addresses linked to specific job opportunities.
          </div>

          {contacts.length === 0 ? (
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
    </div>
  );
};
