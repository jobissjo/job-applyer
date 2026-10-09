import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, FileText, Loader2, Mail, Play, Search, Send, Sparkles, Zap } from 'lucide-react';
import { autoApplyApi, formatApiError } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
type Report = Awaited<ReturnType<typeof autoApplyApi.run>>;

export const AutoApply: React.FC = () => {
  const [source,setSource] = useState('technopark');
  const [query,setQuery] = useState('');
  const [page,setPage] = useState(1);
  const [limit,setLimit] = useState(5);
  const [accepted,setAccepted] = useState(false);
  const [running,setRunning] = useState(false);
  const [report,setReport] = useState<Report | null>(null);
  const [error,setError] = useState('');
  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accepted || running || !query.trim()) return;
    setRunning(true); setError(''); setReport(null);
    try { setReport(await autoApplyApi.run({ source,search_query: query.trim(),page,limit })); }
    catch (err) { setError(formatApiError(err,'The run could not be completed. Please try again.')); }
    finally { setRunning(false); setAccepted(false); }
  };
  const steps = [
    { title: 'Discover opportunities', text: 'Search your chosen source for the roles you want.', icon: Search },
    { title: 'Match and prepare', text: 'Analyze roles, select a resume or create one from your profile, and write cover letters.', icon: Sparkles },
    { title: 'Send or save for later', text: 'Send when an email connection and recruiter contact are available. Otherwise, save the application for your next step.', icon: Send },
  ];
  return <div>
    <div className="page-heading"><div><span className="eyebrow">A little help with the busywork</span><h1>Auto apply</h1><p>Discover jobs and prepare applications in one run.</p></div><Link to="/applications" className="btn btn-secondary">View applications <ArrowRight size={14} /></Link></div>
    {error && <div className="alert alert-danger" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}
    <div className="automation-layout">
      <section className="card"><span className="step-label"><span className="step-number">1</span> Set up your search</span><h2 className="card-title">What are you looking for?</h2><p className="card-subtitle">Choose a source, add a keyword, and keep your first batch small.</p>
        <form onSubmit={start}><fieldset disabled={running} style={{ border: 0, minWidth: 0 }}>
          <div className="form-group"><label htmlFor="auto-query" className="form-label">Job title or skill</label><input id="auto-query" className="form-input" placeholder="e.g. Python developer" required value={query} onChange={e => setQuery(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="auto-source" className="form-label">Where to search</label><select id="auto-source" className="form-select" value={source} onChange={e => setSource(e.target.value)}><option value="technopark">Technopark · Trivandrum</option><option value="infopark">Infopark · Kochi</option></select></div>
          <div className="grid-2"><div className="form-group"><label htmlFor="auto-limit" className="form-label">Jobs per run</label><input id="auto-limit" className="form-input" type="number" required min={1} max={20} value={limit} onChange={e => setLimit(Number(e.target.value))} /></div><div className="form-group"><label htmlFor="auto-page" className="form-label">Start from page</label><input id="auto-page" className="form-input" type="number" required min={1} value={page} onChange={e => setPage(Number(e.target.value))} /></div></div>
          <label className="automation-consent"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span><strong>This run can send application emails.</strong>I understand applications may be sent automatically using my email connection. If no resume is available, one may be created from my profile.</span></label>
          <button type="submit" className="btn btn-primary" disabled={running || !accepted || !query.trim()}>{running ? <Loader2 size={16} className="spinner" /> : <Play size={15} />}{running ? 'Working on your applications…' : 'Start auto apply'}</button>
        </fieldset></form>
        {running && <p role="status" style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>Searching, matching, and preparing applications. Results will appear when the run finishes.</p>}
      </section>
      <aside className="card"><span className="eyebrow">How it works</span><h2 className="card-title" style={{ marginTop: 6 }}>From search to application</h2>{steps.map((step,index) => <div className="workflow-step" key={step.title}><span className="step-number">{index+1}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></div>)}<div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-color)' }}><p className="card-subtitle">For individual review before sending, use Find jobs.</p><Link to="/jobs" className="text-link">Browse jobs yourself <ArrowRight size={13} /></Link></div></aside>
    </div>
    {report && <section style={{ marginTop: 28 }} aria-live="polite"><div className="section-header"><div><h2>Your run is complete</h2><p>Review what happened and take the next step.</p></div><span className="badge badge-source">{report.source} · {report.query}</span></div><div className="grid-4" style={{ marginBottom: 22 }}>{[{label: 'Jobs processed',value:report.total_processed},{label:'Applications sent',value:report.jobs.filter(j=>j.status==='sent').length},{label:'Ready to send',value:report.jobs.filter(j=>j.status==='ready').length},{label:'Contacts needed',value:report.jobs.filter(j=>j.status==='hr_contact_required').length}].map(item => <div className="stat-card" key={item.label}><span className="stat-label">{item.label}</span><span className="stat-value">{item.value}</span></div>)}</div><div className="card"><div className="section-header"><div><h2>Run details</h2><p>The outcome for each opportunity.</p></div></div>{report.jobs.length===0 ? <div className="empty-state"><h3>No opportunities processed</h3><p>Try another keyword or source.</p></div> : report.jobs.map(job => <article className="run-result" key={job.job_id}><div className="run-result-header"><div><h3>{job.title}</h3><p>{job.company}{job.matched_title ? ' · ' + job.matched_title : ''}</p></div><StatusBadge status={job.status} /></div><div className="run-result-details"><span><Mail size={13} />{job.hr_email || 'Recruiter contact needed'}</span><span><FileText size={13} />{job.resume_used || 'No resume selected'}</span></div><p>{job.message}</p><Link to={'/jobs/' + job.job_id} className="text-link" style={{ marginTop: 12 }}>View opportunity <ArrowRight size={13} /></Link></article>)}</div></section>}
  </div>;
};
