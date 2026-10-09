import React, { useEffect, useState } from 'react';
import { Mail, CheckCircle2, XCircle, Send, ShieldCheck } from 'lucide-react';
import { emailApi } from '../services/api';
import { EmailSettings as IEmailSettings } from '../types';

export const EmailSettings: React.FC = () => {
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [useTls, setUseTls] = useState(true);

  const [isConfigured, setIsConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    emailApi
      .getSettings()
      .then((data) => {
        if (data) {
          setSmtpHost(data.smtp_host);
          setSmtpPort(data.smtp_port);
          setSmtpUsername(data.smtp_username);
          setFromEmail(data.from_email);
          setUseTls(data.use_tls);
          setIsConfigured(data.password_configured);
        }
      })
      .catch(() => setAlert({ type: 'error', text: 'Could not load your email connection. Please try again.' }));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      const saved = await emailApi.updateSettings({
        smtp_host: smtpHost.trim(),
        smtp_port: smtpPort,
        smtp_username: smtpUsername.trim(),
        smtp_password: smtpPassword.trim() || undefined,
        from_email: fromEmail.trim(),
        use_tls: useTls,
      });
      setIsConfigured(saved.password_configured);
      setAlert({ type: 'success', text: 'SMTP configuration saved successfully!' });
      setSmtpPassword('');
    } catch (err: any) {
      setAlert({ type: 'error', text: err.response?.data?.detail || 'Failed to save SMTP settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await emailApi.testConnection();
      setTestResult({
        success: res.success,
        message: res.message || res.error || 'Test completed',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || 'Failed to connect to SMTP server',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div className="page-intro"><span className="eyebrow">Workspace settings</span><h1>Connect your email.</h1><p>Set up and test the email account you will use to send applications.</p></div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'success' ? 'success' : 'danger'}`}>
          {alert.text}
        </div>
      )}

      <div className="card" style={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div className="card-title" style={{ marginBottom: 0 }}>Outgoing Mail Server (SMTP)</div>
            <div className="card-subtitle" style={{ marginBottom: 0 }}>
              Credentials are kept local and passwords are never returned in plain text.
            </div>
          </div>
          {isConfigured && (
            <span className="badge badge-matched">
              <ShieldCheck size={14} /> Password Configured
            </span>
          )}
        </div>

        <form onSubmit={handleSave}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">SMTP Host *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="smtp.gmail.com or mail.example.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">SMTP Port *</label>
              <input
                type="number"
                required
                className="form-input"
                placeholder="587 or 465"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">SMTP Username / Email *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="your.email@gmail.com"
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                SMTP Password / App Password {isConfigured && '(Leave blank to keep existing)'}
              </label>
              <input
                type="password"
                required={!isConfigured}
                className="form-input"
                placeholder={isConfigured ? '••••••••••••' : 'App-specific password'}
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">From Email Address *</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="your.email@gmail.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '28px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useTls}
                  onChange={(e) => setUseTls(e.target.checked)}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable STARTTLS / TLS</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', marginTop: '20px' }}>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            <button
              type="button"
              disabled={!isConfigured || testing}
              onClick={handleTestConnection}
              className="btn btn-secondary"
            >
              <Mail size={16} /> {testing ? 'Testing SMTP...' : 'Test SMTP Connection'}
            </button>
          </div>
        </form>

        {testResult && (
          <div
            className={`alert alert-${testResult.success ? 'success' : 'danger'}`}
            style={{ marginTop: '24px' }}
          >
            {testResult.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <div>
              <strong>{testResult.success ? 'Connection Successful:' : 'Connection Failed:'}</strong>{' '}
              {testResult.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
