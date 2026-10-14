import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { followUpsApi, formatApiError, profileApi } from '../services/api';
import type { Application, ApplicationFollowUp } from '../types';

function followUpBody(application: Application, name = '') {
  const date = application.sent_at
    ? ' sent on ' + new Date(application.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  return 'Dear Hiring Team,\n\nI am following up on my application for the ' +
    (application.job?.title || 'advertised') + ' position' +
    (application.job?.company ? ' at ' + application.job.company : '') + date +
    '. I remain interested in the opportunity and would appreciate any update on my application.\n\n' +
    'Please let me know if there is any additional information I can provide. Thank you for your time and consideration.\n\nBest regards' +
    (name ? ',\n' + name : '');
}

export function FollowUpPanel({ application }: { application: Application }) {
  const { hash } = useLocation();
  const panel = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const [subject, setSubject] = useState(('Follow-up: ' + (application.email_subject || 'Application for ' + application.job?.title)).slice(0, 500));
  const [body, setBody] = useState(followUpBody(application));
  const [sendAt, setSendAt] = useState('');
  const [attachResume, setAttachResume] = useState(false);
  const [history, setHistory] = useState<ApplicationFollowUp[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const edited = useRef(false);

  useEffect(() => {
    if (hash === '#follow-up') panel.current?.scrollIntoView({ block: 'start' });
  }, [hash]);
  useEffect(() => {
    let active = true;
    setHistoryLoading(true); setHistoryError('');
    followUpsApi.list(application.id).then(items => { if (active) setHistory(items); })
      .catch(err => { if (active) setHistoryError(formatApiError(err, 'Could not load follow-up history.')); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [application.id, refresh]);
  useEffect(() => {
    let active = true;
    profileApi.getProfile().then(profile => {
      if (active && !edited.current) setBody(followUpBody(application, profile?.name || ''));
    }).catch(() => {});
    return () => { active = false; };
  }, [application.id]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || messageSent || !subject.trim() || !body.trim()) return;
    if (sendAt && (!Number.isFinite(new Date(sendAt).getTime()) || new Date(sendAt).getTime() <= Date.now())) { setError('Choose a future date and time.'); return; }
    edited.current = true;
    inFlight.current = true; setSending(true); setError(''); setMessage('');
    try {
      const result = await followUpsApi.send(application.id, {
        request_id: requestId.current, subject: subject.trim(), body: body.trim(), attach_resume: attachResume, scheduled_at: sendAt ? new Date(sendAt).toISOString() : undefined,
      });
      setHistory(items => [result, ...items.filter(item => item.id !== result.id)]);
      if (result.status === 'sent') { setMessage('Follow-up sent to ' + result.recipient + '.'); setMessageSent(true); }
      else if (result.status === 'scheduled') { setMessage('Follow-up scheduled for ' + new Date(result.scheduled_at!).toLocaleString('en-IN') + '.'); setMessageSent(true); }
      else if (result.status === 'failed') setError(result.error_message || 'Could not send the follow-up. Check your email connection.');
      else setMessage('This follow-up is still being processed. Refresh the history to check its status.');
      if (result.status !== 'sending') requestId.current = crypto.randomUUID();
    } catch (err) { setError(formatApiError(err, 'Could not send the follow-up.')); }
    finally { inFlight.current = false; setSending(false); }
  };
  const change = () => {
    edited.current = true;
    setMessageSent(false);
    if (!sending) requestId.current = crypto.randomUUID();
    setMessage(''); setError('');
  };

  return <section id="follow-up" className="follow-up-section" ref={panel}>
    <div className="section-header"><div><span className="eyebrow">Keep the conversation going</span><h2 className="follow-up-heading">Send a follow-up</h2><p>A short, thoughtful check-in about your application.</p></div><Mail size={20} color="var(--primary)" /></div>
    <div className="review-layout">
      <form className="card" onSubmit={send}>
        <h3 className="card-title">Your follow-up message</h3><p className="card-subtitle">Edit the suggested message before sending to the original recruiter.</p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {message && <div className="alert alert-success" role="status"><CheckCircle2 size={16} />{message}</div>}
        <div className="form-group"><label htmlFor="follow-up-to" className="form-label">To</label><input id="follow-up-to" className="form-input" readOnly value={application.sent_to || ''} /></div>
        <div className="form-group"><label htmlFor="follow-up-subject" className="form-label">Subject</label><input id="follow-up-subject" className="form-input" required maxLength={500} value={subject} disabled={sending} onChange={event => { change(); setSubject(event.target.value); }} /></div>
        <div className="form-group"><label htmlFor="follow-up-body" className="form-label">Message</label><textarea id="follow-up-body" className="form-textarea" rows={11} required maxLength={20000} value={body} disabled={sending} onChange={event => { change(); setBody(event.target.value); }} /></div>
        {application.resume && <label className="follow-up-attachment"><input type="checkbox" checked={attachResume} disabled={sending} onChange={event => { change(); setAttachResume(event.target.checked); }} /><span>Attach the original resume<span className="table-company">{application.resume.file_name}</span></span></label>}
        <div className="form-group"><label htmlFor="follow-up-send-at" className="form-label">Schedule send (optional)</label><input id="follow-up-send-at" type="datetime-local" className="form-input" value={sendAt} disabled={sending} onChange={event => { change(); setSendAt(event.target.value); }} /><p className="card-subtitle">Choose a time in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Leave empty to send now.</p></div>
        <div className="review-save"><span>Sent using your email connection.</span><button className="btn btn-primary" type="submit" disabled={sending || messageSent || !application.sent_to || !subject.trim() || !body.trim()}>{sending ? <Loader2 size={15} className="spinner" /> : <Send size={15} />}{sending ? 'Sending follow-up…' : messageSent ? 'Follow-up sent' : 'Send follow-up'}</button></div>
      </form>
      <aside className="card"><div className="section-header"><div><h3 className="card-title">Follow-up history</h3><p>Your original application stays unchanged.</p></div><button className="icon-button" title="Refresh history" aria-label="Refresh follow-up history" disabled={historyLoading || sending} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={16} /></button></div>
        {historyLoading ? <div className="loading-state" role="status">Loading follow-ups…</div> : historyError ? <div className="alert alert-danger" role="alert">{historyError}</div> : history.length === 0 ? <div className="empty-state"><span className="empty-state-icon"><Mail size={20} /></span><h3>No follow-ups yet</h3><p>Your sent messages and send attempts will appear here.</p></div> : history.map(item => <details className="follow-up-history-item" key={item.id}><summary><div><span className={'badge badge-' + (item.status === 'sending' ? 'ready' : item.status)}>{item.status === 'sending' ? 'Sending' : item.status === 'sent' ? 'Sent' : item.status === 'scheduled' ? 'Scheduled' : item.status === 'cancelled' ? 'Cancelled' : 'Failed'}</span><strong>{item.subject}</strong><span className="table-company">{new Date(item.sent_at || item.scheduled_at || item.created_at).toLocaleString('en-IN')}</span></div></summary><div className="follow-up-history-body"><p className="table-company">To: {item.recipient}{item.attach_resume ? ' · Resume attached' : ''}</p><p>{item.body}</p>{item.status === 'scheduled' && <button type="button" className="btn btn-secondary" disabled={sending} onClick={async () => { setSending(true); setError(''); try { const result = await followUpsApi.cancel(application.id, item.id); setHistory(items => items.map(entry => entry.id === result.id ? result : entry)); setMessageSent(false); } catch (err) { setError(formatApiError(err, 'Could not cancel the schedule.')); } finally { setSending(false); } }}>Cancel schedule</button>}{item.error_message && <div className="alert alert-danger">{item.error_message}</div>}</div></details>)}
      </aside>
    </div>
  </section>;
}
