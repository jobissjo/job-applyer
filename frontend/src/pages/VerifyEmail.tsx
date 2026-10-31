import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { authApi, formatApiError } from '../services/api';

export const VerifyEmail: React.FC = () => {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const run = async (resend: boolean) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = resend
        ? await authApi.resendVerification(email.trim())
        : await authApi.verifyEmail(email.trim(), code.trim());
      setMessage(result.message);
      if (!resend) setVerified(true);
    } catch (err) { setError(formatApiError(err, 'Could not verify your email.')); }
    finally { setBusy(false); }
  };
  return <AuthLayout>
    <span className="eyebrow">Check your inbox</span>
    <h1>Verify your email.</h1>
    <p>Enter the six-digit code sent to your email address. It expires in 10 minutes. Check your spam folder too.</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <p role="status">{message}</p>}
    {!verified && <form onSubmit={event => { event.preventDefault(); void run(false); }}>
      <div className="form-group"><label className="form-label" htmlFor="verify-email">Email address</label>
        <input id="verify-email" className="form-input" type="email" autoComplete="email" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></div>
      <div className="form-group"><label className="form-label" htmlFor="verify-code">Verification code</label>
        <input id="verify-code" className="form-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={e => setCode(e.target.value)} /></div>
      <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Verify email'}</button>
      <button className="btn auth-submit" type="button" disabled={busy || !email.trim()} onClick={() => void run(true)}>Resend code</button>
      <p>Wait 60 seconds between requests. Only the latest code works.</p>
    </form>}
    <div className="auth-footer"><Link to="/login">Back to sign in</Link></div>
  </AuthLayout>;
};
