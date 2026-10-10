import { TableSkeleton, Skeleton } from '../components/ListSkeleton';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, ArrowUpRight, Briefcase, Check, CheckCircle2, Cpu, FileText, ListTodo, Mail, Search, Send, UserRound } from 'lucide-react';
import { applicationsApi, profileApi, resumesApi, jobTitlesApi, llmApi, emailApi } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import type { Application, DashboardStats } from '../types';

type SetupItem = { title: string; caption: string; path: string; icon: typeof UserRound; complete: boolean | null };
export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [setup, setSetup] = useState<SetupItem[]>([]);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.allSettled([applicationsApi.getDashboardStats(), applicationsApi.list(), profileApi.getProfile(), jobTitlesApi.list(), resumesApi.list(), llmApi.list(), emailApi.getSettings()])
      .then(([s, apps, profile, titles, resumes, providers, email]) => {
        if (!active) return;
        if (s.status === 'fulfilled') setStats(s.value); else setError('Your overview could not be fully loaded. Check that the backend is running and try again.');
        if (apps.status === 'fulfilled') setRecentApps([...apps.value].sort((a,b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0,5));
        else setError('Your recent applications could not be loaded. Try again.');
        if (profile.status === 'fulfilled') setName(profile.value?.name || '');
        setSetup([
          { title: 'Complete your profile', caption: 'Your experience and contact details', path: '/profile', icon: UserRound, complete: profile.status === 'fulfilled' ? !!profile.value?.name : null },
          { title: 'Choose your target roles', caption: 'Tell us what you are looking for', path: '/job-titles', icon: ListTodo, complete: titles.status === 'fulfilled' ? titles.value.some(t => t.active) : null },
          { title: 'Add a resume', caption: 'Bring your experience to each application', path: '/resumes', icon: FileText, complete: resumes.status === 'fulfilled' ? resumes.value.some(r => r.active) : null },
          { title: 'Connect an AI provider', caption: 'Match jobs and write cover letters', path: '/llm-providers', icon: Cpu, complete: providers.status === 'fulfilled' ? providers.value.some(p => p.active && p.enabled && p.api_key_configured) : null },
          { title: 'Connect your email', caption: 'Send applications from your own address', path: '/email-settings', icon: Mail, complete: email.status === 'fulfilled' ? !!(email.value?.smtp_host && email.value?.password_configured) : null },
        ]);
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const completed = setup.filter(item => item.complete).length;
  const metrics = [
    { label: 'Jobs discovered', value: stats?.total_jobs, icon: Briefcase, caption: 'Across your connected job sources', path: '/jobs' },
    { label: 'Ready to send', value: stats?.applications_ready, icon: FileText, caption: 'Prepared for your next step', path: '/applications?status=ready' },
    { label: 'Applications sent', value: stats?.applications_sent, icon: Send, caption: 'Your progress so far', path: '/applications?status=sent' },
    { label: 'Contacts needed', value: stats?.hr_contacts_required, icon: UserRound, caption: 'Add a recruiter to move forward', path: '/hr-contacts' },
  ];
  return <div>
    <div className="page-heading"><div><span className="eyebrow">Your job search, in one place</span><h1>{name ? 'Welcome back, ' + name.split(' ')[0] + '.' : 'Your next chapter starts here.'}</h1><p>A clear view of your opportunities and what to do next.</p></div><div className="heading-actions"><Link to="/resumes" className="btn btn-secondary"><FileText size={15} /> My resumes</Link><Link to="/jobs" className="btn btn-primary"><Search size={15} /> Find jobs</Link></div></div>
    {error && <div className="alert alert-danger" role="alert"><AlertCircle size={17} /><span>{error}</span><button className="btn btn-secondary btn-sm" onClick={() => setRetry(n => n+1)}>Retry</button></div>}
    <div className="grid-4 dashboard-stats">{metrics.map(metric => <Link to={metric.path} className="stat-card" key={metric.label}><div className="stat-top"><span className="stat-label">{metric.label}</span><span className="stat-icon"><metric.icon size={16} /></span></div><div className="stat-value">{loading ? <Skeleton width={60} height={32} /> : metric.value ?? '—'}</div><span className="stat-footnote">{metric.caption}</span></Link>)}</div>
    <div className="dashboard-columns">
      <div className="dashboard-main">
        <section className="welcome-panel"><div><span className="eyebrow">Make your next move</span><h2>Good opportunities.<br />Thoughtful applications.</h2><p>Explore roles from Infopark and Technopark, find a fit, and put your best experience forward.</p><Link to="/jobs" className="btn btn-primary">Explore opportunities <ArrowRight size={15} /></Link></div><div className="welcome-illustration" aria-hidden="true"><div className="illustration-file"><FileText size={42} strokeWidth={1.3} /></div></div></section>
        <section className="card"><div className="section-header"><div><h2>Recent applications</h2><p>Your latest activity, from preparation to sending.</p></div><Link to="/applications" className="text-link">View all <ArrowUpRight size={14} /></Link></div>
          {loading ? <TableSkeleton columns={["Opportunity", "Status", "Updated", ""]} rows={4} label="Loading your applications…" /> : error && recentApps.length === 0 ? <div className="empty-state"><h3>Application activity is unavailable</h3><p>Try again when your connection is restored.</p></div> : recentApps.length === 0 ? <div className="empty-state"><span className="empty-state-icon"><Send size={22} /></span><h3>Your first application is waiting</h3><p>Find a role you like, choose a resume, and prepare a cover letter. Your progress will appear here.</p><Link to="/jobs" className="btn btn-secondary">Find your first opportunity <ArrowRight size={14} /></Link></div> : <div className="table-container"><table><thead><tr><th>Opportunity</th><th>Status</th><th>Updated</th><th><span className="sr-only">Open application</span></th></tr></thead><tbody>{recentApps.map(app => <tr key={app.id}><td><Link to={'/applications/' + app.id} className="table-job">{app.job?.title || 'Application #' + app.id}</Link><span className="table-company">{app.job?.company || 'Company unavailable'}</span></td><td><StatusBadge status={app.status} /></td><td>{new Date(app.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td><td><Link className="icon-button" to={'/applications/' + app.id} aria-label={'Open application ' + app.id}><ArrowUpRight size={16} /></Link></td></tr>)}</tbody></table></div>}
        </section>
      </div>
      <aside className="dashboard-aside">
        <section className="card"><div className="section-header"><div><h2>Your workspace setup</h2><p>{loading ? 'Checking your setup…' : completed + ' of 5 steps complete'}</p></div><CheckCircle2 size={19} color="var(--primary)" /></div><div className="progress-track" role="progressbar" aria-label="Workspace setup" aria-valuemin={0} aria-valuemax={5} aria-valuenow={completed}><span style={{ width: completed * 20 + '%' }} /></div>
          {setup.map(item => <Link to={item.path} className="setup-item" key={item.path}><span className={'setup-icon' + (item.complete ? ' complete' : '')}>{item.complete ? <Check size={15} /> : <item.icon size={15} />}</span><span className="setup-copy"><strong>{item.title}</strong><span>{item.complete === null ? 'Could not check — open settings' : item.complete ? 'Configured' : item.caption}</span></span><ArrowUpRight size={13} color="var(--text-sub)" /></Link>)}
        </section>
        <section className="card needs-attention"><span className="eyebrow">Next steps</span><h2 className="card-title" style={{ marginTop: 6 }}>Keep things moving</h2>
          <div className="attention-row"><FileText size={18} color="var(--accent-cyan)" /><div><strong>{stats ? stats.applications_ready + ' applications ready' : 'Review your applications'}</strong><p>Check your cover letter and resume before sending.</p><Link to="/applications?status=ready" className="text-link">Review applications <ArrowRight size={13} /></Link></div></div>
          <div className="attention-row"><UserRound size={18} color="var(--accent-amber)" /><div><strong>{stats ? stats.hr_contacts_required + ' recruiter contacts needed' : 'Manage recruiter contacts'}</strong><p>Add missing contact details to prepare your next application.</p><Link to="/hr-contacts" className="text-link">Manage contacts <ArrowRight size={13} /></Link></div></div>
        </section>
      </aside>
    </div>
  </div>;
};
