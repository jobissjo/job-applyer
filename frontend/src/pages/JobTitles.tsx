import { TableSkeleton } from '../components/ListSkeleton';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, ListTodo } from 'lucide-react';
import { jobTitlesApi } from '../services/api';
import { JobTitle } from '../types';

export const JobTitles: React.FC = () => {
  const [titles, setTitles] = useState<JobTitle[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitleText, setEditTitleText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTitles = async () => {
    try {
      const data = await jobTitlesApi.list();
      setTitles(data);
    } catch (err) {
      setError('Could not load or update your target roles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTitles();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError('');
    try {
      await jobTitlesApi.create(newTitle.trim());
      setNewTitle('');
      fetchTitles();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add job title');
    }
  };

  const handleToggleActive = async (title: JobTitle) => {
    try {
      await jobTitlesApi.update(title.id, { active: !title.active });
      fetchTitles();
    } catch (err) {
      setError('Could not load or update your target roles. Please try again.');
    }
  };

  const handleStartEdit = (t: JobTitle) => {
    setEditingId(t.id);
    setEditTitleText(t.title);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editTitleText.trim()) return;
    try {
      await jobTitlesApi.update(id, { title: editTitleText.trim() });
      setEditingId(null);
      fetchTitles();
    } catch (err) {
      setError('Could not load or update your target roles. Please try again.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this job title preference?')) return;
    try {
      await jobTitlesApi.delete(id);
      fetchTitles();
    } catch (err) {
      setError('Could not load or update your target roles. Please try again.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div className="page-intro"><span className="eyebrow">Your search preferences</span><h1>What comes next?</h1><p>Choose the roles you want to pursue. Use these to guide your job matches.</p></div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Add New Job Title Form */}
      <div className="card" style={{ marginBottom: '28px', padding: '20px' }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Senior Python Developer, Backend Engineer..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Plus size={16} /> Add target role
          </button>
        </form>
      </div>

      {/* Titles List */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: '16px' }}>
          Your Desired Roles ({titles.length})
        </div>

        {loading ? (
          <TableSkeleton columns={["Desired Job Title", "Status", "Created At", "Actions"]} label="Loading target roles…" />
        ) : titles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <ListTodo size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p>No job titles added yet. Add roles above to enable AI job matching!</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Desired Job Title</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {titles.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {editingId === t.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={editTitleText}
                            onChange={(e) => setEditTitleText(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                          />
                          <button
                            onClick={() => handleSaveEdit(t.id)}
                            className="btn btn-primary btn-sm"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn btn-secondary btn-sm"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.title}</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(t)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <span className={`badge ${t.active ? 'badge-matched' : 'badge-source'}`}>
                          {t.active ? 'Active' : 'Disabled'}
                        </span>
                      </button>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleStartEdit(t)}
                          className="btn btn-secondary btn-sm"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="btn btn-danger btn-sm"
                          title="Delete"
                        >
                          <Trash2 size={14} />
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
    </div>
  );
};
