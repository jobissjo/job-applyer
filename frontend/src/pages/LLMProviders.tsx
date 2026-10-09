import React, { useEffect, useState } from 'react';
import { Cpu, Plus, Trash2, CheckCircle2, XCircle, ArrowUpDown, Key } from 'lucide-react';
import { llmApi } from '../services/api';
import { LLMProvider } from '../types';

export const LLMProviders: React.FC = () => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const [providerType, setProviderType] = useState<'openrouter' | 'groq' | 'gemini'>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('meta-llama/llama-3.3-70b-instruct');
  const [priority, setPriority] = useState(1);

  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; text: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchProviders = async () => {
    try {
      const data = await llmApi.list();
      setProviders(data);
    } catch (err) {
      setError('Could not load or update your AI providers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleProviderTypeChange = (val: 'openrouter' | 'groq' | 'gemini') => {
    setProviderType(val);
    if (val === 'openrouter') {
      setModel('meta-llama/llama-3.3-70b-instruct');
    } else if (val === 'groq') {
      setModel('llama-3.3-70b-versatile');
    } else if (val === 'gemini') {
      setModel('gemini-1.5-flash');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please provide an API key');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await llmApi.create({
        provider: providerType,
        api_key: apiKey.trim(),
        model: model.trim(),
        priority,
        active: true,
        enabled: true,
      });
      setSuccess(`Provider ${providerType} added successfully!`);
      setApiKey('');
      fetchProviders();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add LLM provider');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this LLM provider configuration?')) return;
    try {
      await llmApi.delete(id);
      fetchProviders();
    } catch (err) {
      setError('Could not load or update your AI providers. Please try again.');
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await llmApi.test(id);
      if (res.success) {
        setTestResult({
          id,
          success: true,
          text: res.response || 'Connection successful! Provider is responding.',
        });
      } else {
        setTestResult({
          id,
          success: false,
          text: res.error || 'Connection test failed.',
        });
      }
    } catch (err: any) {
      setTestResult({
        id,
        success: false,
        text: err.response?.data?.detail || 'Failed to communicate with provider API',
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div className="page-intro"><span className="eyebrow">Workspace settings</span><h1>A little help from AI.</h1><p>Connect a provider for job matching and cover letters. Add a backup for when your first choice is unavailable.</p></div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Add New Provider Card */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-title">Add AI provider</div>
        <div className="card-subtitle">
          API keys are stored locally and never returned unmasked in API responses.
        </div>

        <form onSubmit={handleCreate}>
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Provider *</label>
              <select
                className="form-select"
                value={providerType}
                onChange={(e) => handleProviderTypeChange(e.target.value as any)}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="groq">Groq</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Model Identifier *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. llama-3.3-70b"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Priority (1 = Highest) *</label>
              <input
                type="number"
                required
                min={1}
                max={10}
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">API Key *</label>
            <input
              type="password"
              required
              className="form-input"
              placeholder="sk-... or gsk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary">
            <Plus size={16} /> Save provider
          </button>
        </form>
      </div>

      {/* Existing Configured Providers */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: '16px' }}>
          Configured Providers ({providers.length})
        </div>

        {loading ? <div className="loading-state" role="status">Loading providers…</div> : providers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <Cpu size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p>No LLM providers configured yet. Add at least one provider to enable matching and cover letter generation.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Key Preview</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="badge badge-source" style={{ fontWeight: 700 }}>
                        Priority #{p.priority}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {p.provider}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                        {p.model}
                      </code>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <code>{p.api_key_preview || 'Configured'}</code>
                    </td>
                    <td>
                      <span className={`badge ${p.active && p.enabled ? "badge-matched" : "badge-source"}`}>{p.active && p.enabled ? "Active" : "Inactive"}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleTest(p.id)}
                          disabled={testingId === p.id}
                          className="btn btn-secondary btn-sm"
                        >
                          {testingId === p.id ? 'Testing...' : 'Test API'}
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="btn btn-danger btn-sm"
                          title="Delete Provider"
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

        {testResult && (
          <div
            className={`alert alert-${testResult.success ? 'success' : 'danger'}`}
            style={{ marginTop: '20px' }}
          >
            {testResult.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <div style={{ wordBreak: 'break-word' }}>
              <strong>{testResult.success ? 'API Test Succeeded:' : 'API Test Failed:'}</strong>{' '}
              {testResult.text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
