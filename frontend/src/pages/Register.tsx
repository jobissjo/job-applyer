import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { authApi, formatApiError } from '../services/api';
import { AuthLayout } from '../components/AuthLayout';
export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [confirmPassword,setConfirmPassword] = useState('');
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if(password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await authApi.register(email,password);
      const result = await authApi.login(email,password);
      localStorage.setItem('token',result.access_token);
      navigate('/profile');
    } catch(err) { setError(formatApiError(err,'Could not create your account.')); }
    finally { setLoading(false); }
  };
  return <AuthLayout><span className="eyebrow">A fresh start</span><h1>Start your next chapter.</h1><p>Create an account and make your job search your own.</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <form onSubmit={submit}><div className="form-group"><label className="form-label" htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required className="form-input" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} /></div>
    <div className="form-group"><label className="form-label" htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete="new-password" required className="form-input" placeholder="Choose a password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
    <div className="form-group"><label className="form-label" htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" type="password" autoComplete="new-password" required className="form-input" placeholder="Enter your password again" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></div>
    <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>{loading ? <Loader2 size={15} className="spinner" /> : null}{loading ? 'Creating your account…' : 'Create account'}{!loading && <ArrowRight size={15} />}</button></form>
    <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
  </AuthLayout>;
};
