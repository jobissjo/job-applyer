import React, { useEffect, useState } from 'react';
import { Upload, Trash2, Download, FileText, Check, Plus, Tag } from 'lucide-react';
import { resumesApi, jobTitlesApi } from '../services/api';
import { Resume, JobTitle } from '../types';

export const Resumes: React.FC = () => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);

  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTitleIds, setSelectedTitleIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing mapping modal state
  const [editingResume, setEditingResume] = useState<Resume | null>(null);
  const [editingTitleIds, setEditingTitleIds] = useState<number[]>([]);

  const fetchData = async () => {
    try {
      const [r, jt] = await Promise.all([resumesApi.list(), jobTitlesApi.list()]);
      setResumes(r);
      setJobTitles(jt);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      if (!title) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) {
      setError('Please select a file and enter a title');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('file', selectedFile);
      if (selectedTitleIds.length > 0) {
        formData.append('job_title_ids', selectedTitleIds.join(','));
      }

      await resumesApi.upload(formData);
      setSuccess('Resume uploaded and parsed successfully!');
      setTitle('');
      setSelectedFile(null);
      setSelectedTitleIds([]);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this resume?')) return;
    try {
      await resumesApi.delete(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const openEditMapping = (r: Resume) => {
    setEditingResume(r);
    setEditingTitleIds(r.mapped_job_titles.map((t) => t.id));
  };

  const saveEditMapping = async () => {
    if (!editingResume) return;
    try {
      await resumesApi.update(editingResume.id, { job_title_ids: editingTitleIds });
      setEditingResume(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Resume Management
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Upload PDF/DOCX resumes and map them to your desired job titles. When an opportunity matches a role, the mapped resume is automatically pre-selected.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Upload Box */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-title">Upload New Resume</div>
        <div className="card-subtitle">
          Supports PDF and DOCX. Resume text will be automatically extracted locally for tailored LLM matching.
        </div>

        <form onSubmit={handleUpload}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Resume Label / Title *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Python Backend Resume, Senior Software Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">File (.pdf, .docx) *</label>
              <input
                type="file"
                required
                accept=".pdf,.docx,.doc"
                className="form-input"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Associate with Desired Job Titles</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {jobTitles.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                  No job titles created yet. (Add titles under "Job Titles" first)
                </span>
              ) : (
                jobTitles.map((t) => {
                  const selected = selectedTitleIds.includes(t.id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => {
                        setSelectedTitleIds((prev) =>
                          selected ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        );
                      }}
                      className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      <Tag size={12} /> {t.title}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <button type="submit" disabled={uploading} className="btn btn-primary">
            <Upload size={16} /> {uploading ? 'Parsing and Uploading...' : 'Upload Resume'}
          </button>
        </form>
      </div>

      {/* Resumes Grid */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: '16px' }}>
          Your Stored Resumes ({resumes.length})
        </div>

        {resumes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <FileText size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p>No resumes uploaded yet. Upload your first resume above!</p>
          </div>
        ) : (
          <div className="grid-2">
            {resumes.map((r) => (
              <div
                key={r.id}
                className="card"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {r.file_name} • {r.resume_type.toUpperCase()}
                    </div>
                  </div>
                  <span className="badge badge-matched">Active</span>
                </div>

                {/* Mapped Titles */}
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    MAPPED JOB TITLES:
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {r.mapped_job_titles.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>None (Universal fallback)</span>
                    ) : (
                      r.mapped_job_titles.map((t) => (
                        <span key={t.id} className="badge badge-source">
                          {t.title}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Extracted Text Snippet */}
                {r.extracted_text && (
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-sub)',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      maxHeight: '60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {r.extracted_text}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <button onClick={() => openEditMapping(r)} className="btn btn-secondary btn-sm">
                    Manage Mapping
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={resumesApi.downloadUrl(r.id)}
                      download
                      className="btn btn-secondary btn-sm"
                      title="Download File"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="btn btn-danger btn-sm"
                      title="Delete Resume"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Mapping Modal */}
      {editingResume && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-title">Map Resume to Job Titles</div>
            <p className="card-subtitle">
              Select which desired job titles will trigger automatic selection of{' '}
              <strong>{editingResume.title}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '20px 0' }}>
              {jobTitles.map((t) => {
                const selected = editingTitleIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: selected ? 'var(--primary-glow)' : 'var(--bg-input)',
                      border: `1px solid ${selected ? 'var(--primary)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        setEditingTitleIds((prev) =>
                          selected ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        );
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{t.title}</span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setEditingResume(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={saveEditMapping} className="btn btn-primary">
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
