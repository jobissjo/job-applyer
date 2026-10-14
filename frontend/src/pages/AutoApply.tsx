import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, FileText, Loader2, Mail, Play, Search, Send, Sparkles } from 'lucide-react';
import { applicationsApi, autoApplyApi, formatApiError } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
type Report = Awaited<ReturnType<typeof autoApplyApi.run>>;

export const AutoApply: React.FC = () => {
  const [source,setSource] = useState('technopark');
  const [query,setQuery] = useState('');
  const [page,setPage] = useState(1);
  const [limit,setLimit] = useState(5);
  const [selected,setSelected] = useState<number[]>([]);
  const [scheduleEnabled,setScheduleEnabled] = useState(false);
  const [sendAt,setSendAt] = useState('');
  const [approving,setApproving] = useState(false);
  const [approvalMessage,setApprovalMessage] = useState('');
  const inFlight = useRef(false);
  const [running,setRunning] = useState(false);
  const [report,setReport] = useState<Report | null>(null);
  const [error,setError] = useState('');
  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !query.trim()) return;
    inFlight.current = true;
    setRunning(true); setError(''); setReport(null); setSelected([]); setApprovalMessage('');
    try { setReport(await autoApplyApi.run({ source,search_query: query.trim(),page,limit })); }
    catch (err) { setError(formatApiError(err,'The run could not be completed. Please try again.')); }
    finally { setRunning(false); inFlight.current = false; }
  };
  const eligible = report?.jobs.filter(job => job.status === 'ready' && job.application_id) || [];
  const toggle = (id: number) => setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids,id]);
  const approve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !report || !selected.length) return;
    let scheduledAt: string | undefined;
    if (scheduleEnabled) {
      const date = new Date(sendAt);
      if (!sendAt || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
        setError('Choose a future date and time before approving.'); return;
      }
      scheduledAt = date.toISOString();
    }
    inFlight.current = true; setApproving(true); setError(''); setApprovalMessage('');
    let completed = 0;
    const failures: string[] = [];
    try {
      for (const job of eligible.filter(item => selected.includes(item.application_id!))) {
        try {
          const result = scheduledAt
            ? await applicationsApi.schedule(job.application_id!, scheduledAt)
            : await applicationsApi.send(job.application_id!);
          completed += 1;
          setSelected(ids => ids.filter(id => id !== result.id));
          setReport(previous => previous && ({ ...previous, jobs: previous.jobs.map(item =>
            item.application_id === result.id ? { ...item, status: result.status,
              scheduled_at: result.scheduled_at || undefined,
              message: result.status === 'scheduled'
                ? 'Approved. Scheduled for ' + new Date(result.scheduled_at!).toLocaleString() + '.'
                : 'Approved. Sent to ' + result.sent_to + '.' } : item) }));
        } catch (err) {
          const failure = job.title + ': ' + formatApiError(err,'Could not dispatch this application.');
          failures.push(failure);
          // Reconcile failures before retrying, including schedules accepted before a network error.
          try {
            const current = await applicationsApi.get(job.application_id!);
            setReport(previous => previous && ({ ...previous, jobs: previous.jobs.map(item =>
              item.application_id === current.id ? { ...item, status: current.status,
                message: current.status === 'ready' ? failure : 'Current status: ' + current.status } : item) }));
            if (current.status !== 'ready') setSelected(ids => ids.filter(id => id !== current.id));
          } catch { /* Keep the draft visible when status cannot be refreshed. */ }
        }
      }
      if (completed) setApprovalMessage(completed + (scheduledAt ? ' application(s) approved and scheduled.' : ' application(s) approved and sent.'));
      if (failures.length) setError(failures.join(' · '));
    } finally { inFlight.current = false; setApproving(false); }
  };
  const steps = [
    { title: 'Discover opportunities', text: 'Search your chosen source for the roles you want.', icon: Search },
    { title: 'Match and prepare', text: 'Analyze roles, select a resume or create one from your profile, and write cover letters.', icon: Sparkles },
    { title: 'Review and approve', text: 'Select the jobs you want to apply to. Approve sending now or choose a scheduled time.', icon: Send },
  ];
  return <div>
    <div className="page-heading"><div><span className="eyebrow">A little help with the busywork</span><h1>Auto apply</h1><p>Discover jobs and prepare applications in one run.</p></div><Link to="/applications" className="btn btn-secondary">View applications <ArrowRight size={14} /></Link></div>
    {error && <div className="alert alert-danger" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}
    <div className="automation-layout">
      <section className="card"><span className="step-label"><span className="step-number">1</span> Set up your search</span><h2 className="card-title">What are you looking for?</h2><p className="card-subtitle">Choose a source, add a keyword, and keep your first batch small.</p>
        <form onSubmit={start}><fieldset disabled={running || approving} style={{ border: 0, minWidth: 0 }}>
          <div className="form-group"><label htmlFor="auto-query" className="form-label">Job title or skill</label><input id="auto-query" className="form-input" placeholder="e.g. Python developer" required value={query} onChange={e => setQuery(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="auto-source" className="form-label">Where to search</label><select id="auto-source" className="form-select" value={source} onChange={e => setSource(e.target.value)}><option value="technopark">Technopark · Trivandrum</option><option value="infopark">Infopark · Kochi</option></select></div>
          <div className="grid-2"><div className="form-group"><label htmlFor="auto-limit" className="form-label">Jobs per run</label><input id="auto-limit" className="form-input" type="number" required min={1} max={20} value={limit} onChange={e => setLimit(Number(e.target.value))} /></div><div className="form-group"><label htmlFor="auto-page" className="form-label">Start from page</label><input id="auto-page" className="form-input" type="number" required min={1} value={page} onChange={e => setPage(Number(e.target.value))} /></div></div>
          <p className="card-subtitle">Applications are prepared for your review. Choose which jobs to approve after the search finishes.</p>
          <button type="submit" className="btn btn-primary" disabled={running || approving || !query.trim()}>{running ? <Loader2 size={16} className="spinner" /> : <Play size={15} />}{running ? 'Working on your applications…' : 'Find and prepare applications'}</button>
        </fieldset></form>
        {running && <p role="status" style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>Searching, matching, and preparing applications. Results will appear when the run finishes.</p>}
      </section>
      <aside className="card"><span className="eyebrow">How it works</span><h2 className="card-title" style={{ marginTop: 6 }}>From search to application</h2>{steps.map((step,index) => <div className="workflow-step" key={step.title}><span className="step-number">{index+1}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></div>)}<div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-color)' }}><p className="card-subtitle">Unselected applications stay saved for later review in Your applications.</p><Link to="/jobs" className="text-link">Browse jobs yourself <ArrowRight size={13} /></Link></div></aside>
    </div>
    {approvalMessage && <div className="alert alert-success" role="status">{approvalMessage}</div>}
    {report && <section style={{ marginTop: 28 }} aria-live="polite"><div className="section-header"><div><h2>Review your applications</h2><p>Select the jobs you want to apply to, then approve sending.</p></div><span className="badge badge-source">{report.source} · {report.query}</span></div><div className="grid-4" style={{ marginBottom: 22 }}>{[{label: 'Jobs processed',value:report.total_processed},{label:'Applications sent',value:report.jobs.filter(j=>j.status==='sent').length},{label:'Ready to send',value:report.jobs.filter(j=>j.status==='ready').length},{label:'Contacts needed',value:report.jobs.filter(j=>j.status==='hr_contact_required').length}].map(item => <div className="stat-card" key={item.label}><span className="stat-label">{item.label}</span><span className="stat-value">{item.value}</span></div>)}</div><form className="card" onSubmit={approve} style={{ marginBottom: 22 }}>
        <h2 className="card-title">Approve selected applications</h2>
        <fieldset disabled={approving} style={{ border: 0, minWidth: 0 }}>
          <label className="automation-consent"><input type="checkbox" checked={eligible.length > 0 && eligible.every(job => selected.includes(job.application_id!))} disabled={!eligible.length} onChange={event => setSelected(event.target.checked ? eligible.map(job => job.application_id!) : [])} /><span>Select all ready applications</span></label>
          <label className="automation-consent"><input type="checkbox" checked={scheduleEnabled} onChange={event => setScheduleEnabled(event.target.checked)} /><span>Schedule approved emails</span></label>
          {scheduleEnabled && <div className="form-group"><label className="form-label" htmlFor="auto-send-at">Send date and time</label><input id="auto-send-at" className="form-input" type="datetime-local" required value={sendAt} onChange={event => setSendAt(event.target.value)} /><p className="card-subtitle">Your local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Approved emails will be sent at this time.</p></div>}
          <p className="card-subtitle">Only selected jobs will be approved. Unselected applications stay saved. {scheduleEnabled ? 'Scheduled emails can be cancelled in Your applications.' : 'Approved emails will be sent immediately.'}</p>
          <button type="submit" className="btn btn-primary" disabled={approving || !selected.length}>{approving ? <Loader2 size={15} className="spinner" /> : <Send size={15} />}{approving ? 'Processing approvals…' : (scheduleEnabled ? 'Approve and schedule' : 'Approve and send now') + ' (' + selected.length + ')'}</button>
        </fieldset>
      </form><div className="card"><div className="section-header"><div><h2>Run details</h2><p>Review the recipient, resume, and email for each opportunity.</p></div></div>{report.jobs.length===0 ? <div className="empty-state"><h3>No opportunities processed</h3><p>Try another keyword or source.</p></div> : report.jobs.map(job => <article className="run-result" key={job.job_id}><div className="run-result-header"><div>{job.status === 'ready' && job.application_id && <label className="automation-consent"><input type="checkbox" aria-label={'Apply to ' + job.title + ' at ' + job.company} checked={selected.includes(job.application_id)} disabled={approving} onChange={() => toggle(job.application_id!)} /><span>Apply to this job</span></label>}<h3>{job.title}</h3><p>{job.company}{job.matched_title ? ' · ' + job.matched_title : ''}</p></div><StatusBadge status={job.status} /></div><div className="run-result-details"><span><Mail size={13} />{job.hr_email || 'Recruiter contact needed'}</span><span><FileText size={13} />{job.resume_used || 'No resume selected'}</span></div><p>{job.message}</p>{job.email_subject && <details style={{ marginTop: 12 }}><summary>Review application email</summary><p><strong>Subject:</strong> {job.email_subject}</p><p style={{ whiteSpace: 'pre-wrap' }}>{job.cover_letter_text}</p></details>}<Link to={'/jobs/' + job.job_id} className="text-link" style={{ marginTop: 12 }}>View opportunity <ArrowRight size={13} /></Link></article>)}</div></section>}
  </div>;
};
