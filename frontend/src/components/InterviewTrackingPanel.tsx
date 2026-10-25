import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus } from 'lucide-react';
import { formatApiError } from '../services/api';
import {
  interviewsApi, progressLabels, roundStatusLabels, resultLabels, modeLabels, noteLabels,
  emptyRound, localInterviewDate, interviewISO, roundNeedsUpdate, utcDate, historyChanges, historyValue,
  type HiringProgress, type RoundInput, type InterviewRound, type InterviewTracking,
} from '../services/interviews';

const entries = <T extends Record<string, string>>(labels: T) => Object.entries(labels) as [keyof T & string, string][];

export function InterviewTrackingPanel({ applicationId, roundsOnly = false }: { applicationId: number; roundsOnly?: boolean }) {
  const [data, setData] = useState<InterviewTracking>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<HiringProgress>('awaiting_response');
  const [editor, setEditor] = useState<RoundInput>();
  const [roundId, setRoundId] = useState<number>();
  const [date, setDate] = useState('');
  useEffect(() => {
    let active = true;
    setLoaded(false); setData(undefined); setEditor(undefined); setError('');
    interviewsApi.get(applicationId).then(value => {
      if (active) { setData(value); setProgress(value.application.hiring_progress); }
    }).catch(err => { if (active) setError(formatApiError(err, 'Could not load interview tracking.')); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [applicationId, retry]);
  useEffect(() => {
    if (loaded && data && window.location.hash === '#interview-tracking') {
      document.getElementById('interview-tracking')?.scrollIntoView({ block: 'start' });
    }
  }, [loaded, data]);
  const run = async (work: () => Promise<InterviewTracking>, success: string, close = false) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const value = await work(); setData(value); setProgress(value.application.hiring_progress); setMessage(success);
      if (close) setEditor(undefined);
    } catch (err) { setError(formatApiError(err, 'Could not save interview tracking.')); }
    finally { setBusy(false); }
  };
  const edit = (round?: InterviewRound) => {
    setRoundId(round?.id); setEditor(round ? { ...round } : { ...emptyRound });
    setDate(localInterviewDate(round?.scheduled_at || null)); setError(''); setMessage('');
  };
  const patch = <K extends keyof RoundInput>(key: K, value: RoundInput[K]) => setEditor(old => old && { ...old, [key]: value });
  const fieldId = (key: string) => `interview-${applicationId}-${key}`;
  return <section className="card interview-tracking" id="interview-tracking">
    <div className="section-header"><div><h2><CalendarDays size={19} /> {roundsOnly ? (data?.application.job?.title || 'Interview details') : 'Interviews & outcomes'}</h2><p>{roundsOnly ? data?.application.job?.company : 'Record every round and learn from the experience.'}</p></div><Link className="text-link" to="/interviews">Open tracker</Link></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <div className="alert alert-success" role="status">{message}</div>}
    {!loaded ? <p role="status">Loading interview tracking…</p> : !data ? <button className="btn btn-secondary" onClick={() => setRetry(n => n + 1)}>Try again</button> : <>
      {!roundsOnly && <form className="tracking-progress" onSubmit={e => { e.preventDefault(); void run(() => interviewsApi.progress(applicationId, progress), 'Hiring progress saved.'); }}>
        <div><label className="form-label" htmlFor={fieldId('progress')}>Hiring progress</label><select className="form-select" id={fieldId('progress')} value={progress} disabled={busy} onChange={e => setProgress(e.target.value as HiringProgress)}>{entries(progressLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <button className="btn btn-secondary" disabled={busy || progress === data.application.hiring_progress}>Update progress</button>
      </form>}
      <div className="section-header"><div><h3>Interview rounds</h3><p>Past appointments stay scheduled until you record what happened.</p></div><button className="btn btn-primary" disabled={busy || !!editor} onClick={() => edit()}><Plus size={15} /> Add round</button></div>
      {!data.rounds.length && !editor && <p className="card-subtitle">No rounds recorded. Add your first interview to track its schedule and outcome.</p>}
      <div className="tracking-rounds">{data.rounds.map(round => <article className="tracking-round" key={round.id}>
        <div className="section-header"><div><h3>{round.name}</h3><p>{roundStatusLabels[round.status]} · {round.status === 'completed' ? resultLabels[round.result] : modeLabels[round.mode]}</p></div><button className="btn btn-secondary btn-sm" disabled={busy || !!editor} onClick={() => edit(round)}>Edit / reschedule</button></div>
        {roundNeedsUpdate(round) && <p className="alert alert-warning">Needs update: this appointment has passed. Record whether you attended, missed it, or rescheduled.</p>}
        <dl className="tracking-notes">
          {round.scheduled_at && <><dt>Date & time</dt><dd>{utcDate(round.scheduled_at).toLocaleString()}</dd></>}
          {round.location && <><dt>Meeting link / location</dt><dd>{round.location}</dd></>}
          {round.contact && <><dt>Contact</dt><dd>{round.contact}</dd></>}
          {entries(noteLabels).filter(([key]) => round[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{round[key]}</dd></div>)}
        </dl>
      </article>)}</div>
      {editor && <form className="tracking-editor" onSubmit={e => {
        e.preventDefault(); void run(() => interviewsApi.saveRound(applicationId, { ...editor, scheduled_at: interviewISO(date) }, roundId), 'Interview round saved.', true);
      }}>
        <h3>{roundId === undefined ? 'Add interview round' : 'Update interview round'}</h3>
        <fieldset disabled={busy}>
          <div className="tracking-fields">
            <div className="form-group"><label className="form-label" htmlFor={fieldId('name')}>Round name *</label><input className="form-input" id={fieldId('name')} required maxLength={200} value={editor.name} onChange={e => patch('name', e.target.value)} placeholder="Technical round 1" /></div>
            <div className="form-group"><label className="form-label" htmlFor={fieldId('date')}>Date & time ({Intl.DateTimeFormat().resolvedOptions().timeZone})</label><input className="form-input" id={fieldId('date')} type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required={editor.status === 'scheduled'} /></div>
            <div className="form-group"><label className="form-label" htmlFor={fieldId('status')}>Round status</label><select className="form-select" id={fieldId('status')} value={editor.status} onChange={e => {
              const status = e.target.value as RoundInput['status'];
              setEditor({ ...editor, status, result: status === 'completed' ? editor.result : 'awaiting_result' });
            }}>{entries(roundStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="form-group"><label className="form-label" htmlFor={fieldId('result')}>Round result</label><select className="form-select" id={fieldId('result')} value={editor.result} disabled={editor.status !== 'completed'} onChange={e => patch('result', e.target.value as RoundInput['result'])}>{entries(resultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="form-group"><label className="form-label" htmlFor={fieldId('mode')}>Interview mode</label><select className="form-select" id={fieldId('mode')} value={editor.mode} onChange={e => patch('mode', e.target.value as RoundInput['mode'])}>{entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="form-group"><label className="form-label" htmlFor={fieldId('contact')}>Contact details</label><input className="form-input" id={fieldId('contact')} maxLength={500} value={editor.contact} onChange={e => patch('contact', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label" htmlFor={fieldId('location')}>Meeting link / location</label><input className="form-input" id={fieldId('location')} maxLength={2000} value={editor.location} onChange={e => patch('location', e.target.value)} /></div>
          {entries(noteLabels).map(([key, label]) => <div className="form-group" key={key}><label className="form-label" htmlFor={fieldId(key)}>{label}</label><textarea className="form-textarea" id={fieldId(key)} rows={3} maxLength={50000} value={editor[key]} onChange={e => patch(key, e.target.value)} /></div>)}
          <div className="heading-actions"><button className="btn btn-primary" disabled={!editor.name.trim()}>{busy ? 'Saving…' : 'Save round'}</button><button type="button" className="btn btn-secondary" onClick={() => setEditor(undefined)}>Cancel editing</button></div>
        </fieldset>
      </form>}
      {!roundsOnly && !!data.history.length && <details className="tracking-history"><summary>Change history ({data.history.length})</summary>{data.history.map(change => <article key={change.id}><h4>{change.description}</h4><p className="card-subtitle">{utcDate(change.created_at).toLocaleString()}</p><dl className="tracking-notes">{historyChanges(change).map(key => <div key={key}><dt>{({ ...noteLabels, progress: 'Hiring progress', scheduled_at: 'Date & time' } as Record<string, string>)[key] || key.replace(/_/g, ' ')}</dt><dd>{key in change.before && <><span className="card-subtitle">Previously: {historyValue(key, change.before[key])}</span><br /></>}{historyValue(key, change.after[key])}</dd></div>)}</dl></article>)}</details>}
    </>}
  </section>;
}
