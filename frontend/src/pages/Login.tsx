import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { authApi, formatApiError } from '../services/api';
import { AuthLayout } from '../components/AuthLayout';
export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');

  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');

    setLoading(true);
    try {

      const result = await authApi.login(email,password);
      localStorage.setItem('token',result.access_token);
      navigate('/dashboard');
    } catch(err) { setError(formatApiError(err,'Could not sign in. Check your email and password.')); }
    finally { setLoading(false); }
  };
  return <AuthLayout><span className="eyebrow">Your personal workspace</span><h1>Welcome back.</h1><p>Sign in to pick up where you left off.</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <form onSubmit={submit}><div className="form-group"><label className="form-label" htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required className="form-input" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} /></div>
    <div className="form-group"><label className="form-label" htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete="current-password" required className="form-input" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} /></div>

    <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>{loading ? <Loader2 size={15} className="spinner" /> : null}{loading ? 'Signing in…' : 'Sign in'}{!loading && <ArrowRight size={15} />}</button></form>
    <div className="auth-footer">New here? <Link to="/register">Create an account</Link></div>
  </AuthLayout>;
};
