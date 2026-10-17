import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { interviewPreparationApi, resumesApi, formatApiError } from '../services/api';
import type { Application, InterviewPreparation, Resume } from '../types';

export function InterviewPreparationPanel({ application }: { application: Application }) {
  const [plan, setPlan] = useState<InterviewPreparation | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeId, setResumeId] = useState<number | null>(application.resume_id || null);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    const current = ++version.current;
    setLoading(true); setLoaded(false); setError(''); setResumeError('');
    Promise.allSettled([interviewPreparationApi.get(application.id), resumesApi.list()]).then(([saved, list]) => {
      if (version.current !== current) return;
      if (saved.status === 'fulfilled') {
        setPlan(saved.value); setLoaded(true); setReplacing(false);
        setContext(saved.value?.context || '');
        setResumeId(saved.value ? saved.value.resume_id : application.resume_id || null);
      } else setError(formatApiError(saved.reason, 'Could not load interview preparation.'));
      if (list.status === 'fulfilled') setResumes(list.value);
      else setResumeError('Resumes could not be loaded. You can still prepare using the job and profile.');
      setLoading(false);
    });
    return () => { version.current++; };
  }, [application.id, retry]);

  const run = async (work: () => Promise<InterviewPreparation>, success: string) => {
    if (inFlight.current) return;
    const current = version.current;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await work();
      if (version.current === current) { setPlan(result); setReplacing(false); setMessage(success); }
    } catch (err) { if (version.current === current) setError(formatApiError(err, 'Could not update your study plan.')); }
    finally { inFlight.current = false; if (version.current === current) setBusy(false); }
  };
  const completed = plan?.sections.filter(section => section.completed).length || 0;
  const total = plan?.sections.length || 0;
  const remainingMinutes = plan?.sections.filter(section => !section.completed).reduce((sum, section) => sum + section.estimated_minutes, 0) || 0;

  return <section id="interview-preparation" className="card interview-preparation">
    <div className="section-header"><div><h2><BookOpen size={18} /> Prepare for interview</h2><p>A focused study plan for {application.job?.title || 'this application'}, saved with your application.</p></div>{plan && !replacing && <button className="btn btn-secondary btn-sm" disabled={busy || loading} onClick={() => { setReplacing(true); setError(''); setMessage(''); }}><RefreshCw size={14} /> Generate a new plan</button>}</div>
    {loading && <p role="status">Loading your preparation…</p>}
    {error && <div className="alert alert-danger" role="alert">{error}<button type="button" className="btn btn-secondary btn-sm" disabled={busy || loading} onClick={() => setRetry(value => value + 1)}>Reload saved plan</button></div>}
    {message && <div className="alert alert-success" role="status"><CheckCircle2 size={16} />{message}</div>}
    {!loading && loaded && (!plan || replacing) && <form onSubmit={event => {
      event.preventDefault();
      void run(() => interviewPreparationApi.generate(application.id, { resume_id: resumeId, context: context.trim(), replace_generation: plan?.generation_id }), 'Study plan saved. Mark each section complete as you prepare.');
    }}>
      <p className="card-subtitle">AI suggests what to revise, why it matters, practical exercises, and sample questions using this role, your profile, and an optional resume. <Link to="/llm-providers" className="text-link">Configure AI providers</Link></p>
      {replacing && <div className="alert alert-warning">Generating a new plan replaces the current sections and resets their completion checklist. Your current plan stays saved if generation fails.</div>}
      {resumeError && <p role="status" className="card-subtitle">{resumeError}</p>}
      <fieldset disabled={busy}>
        <div className="form-group"><label className="form-label" htmlFor={`prep-resume-${application.id}`}>Resume for preparation <span className="optional-label">Optional</span></label><select id={`prep-resume-${application.id}`} className="form-select" value={resumeId ?? ''} onChange={event => setResumeId(Number(event.target.value) || null)}>
          <option value="">Use job and profile only</option>
          {resumeId && !resumes.some(resume => resume.id === resumeId) && <option value={resumeId}>{plan?.resume_title || application.resume?.title || 'Application resume'}</option>}
          {resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.title}</option>)}
        </select><p className="card-subtitle" style={{ marginTop: 8 }}>This selection is only for interview preparation and does not change your application attachment.</p></div>
        <div className="form-group"><label className="form-label" htmlFor={`prep-context-${application.id}`}>Interview context <span className="optional-label">Optional</span></label><textarea id={`prep-context-${application.id}`} className="form-textarea" rows={3} maxLength={3000} value={context} onChange={event => setContext(event.target.value)} placeholder="e.g. Technical interview in 3 days, 1 hour of study each day. Focus on SQL and my recent project." /></div>
        <div className="heading-actions"><button type="submit" className="btn btn-primary">{busy ? <Loader2 size={15} className="spinner" /> : <Sparkles size={15} />}{busy ? 'Preparing your study plan…' : replacing ? 'Replace plan and reset checklist' : 'Prepare for interview'}</button>{replacing && <button type="button" className="btn btn-secondary" onClick={() => { setReplacing(false); setContext(plan?.context || ''); setResumeId(plan?.resume_id || null); }}>Keep saved plan</button>}</div>
      </fieldset>
    </form>}
    {plan && !loading && <div>
      <p className="interview-summary">{plan.summary}</p>
      <div className="learning-summary"><span>{completed} of {total} sections completed</span><span>About {remainingMinutes} minutes of study remaining</span><span>Based on {plan.resume_title || 'job and profile only'}</span></div>
      {plan.context && <p className="card-subtitle">Interview context: {plan.context}</p>}
      <div className="progress-track" role="progressbar" aria-label="Interview study progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}><span style={{ width: `${total ? completed / total * 100 : 0}%` }} /></div>
      <p className="card-subtitle" style={{ marginTop: 14 }}>Start with high priority sections. Questions are practice suggestions; study times are estimates.</p>
      <div className="interview-sections">{plan.sections.map(section => <article key={plan.generation_id + '-' + section.id} className="interview-section">
        <div className="interview-section-toolbar"><span className={`badge badge-${section.priority === 'high' ? 'hr_contact_required' : section.priority === 'medium' ? 'ready' : 'source'}`}>{section.priority} priority</span><span className="card-subtitle">About {section.estimated_minutes} min</span><label className="interview-complete"><input type="checkbox" checked={section.completed} disabled={busy || replacing} onChange={event => void run(() => interviewPreparationApi.setCompleted(application.id, section.id, plan.generation_id, event.target.checked), 'Study progress saved.')} />Completed<span className="sr-only">: {section.title}</span></label></div>
        <details open={section.priority === 'high' && !section.completed}><summary>{section.title}</summary>
          <p className="interview-reason">{section.reason}</p>
          <h3>What to study</h3><ul>{section.topics.map((topic, index) => <li key={index}>{topic}</li>)}</ul>
          <h3>Practice tasks</h3><ul>{section.practice_tasks.map((task, index) => <li key={index}>{task}</li>)}</ul>
          <h3>Sample interview questions</h3>{section.questions.map((question, index) => <details className="interview-question" key={index}><summary>{question.question}</summary><p><strong>Points to cover:</strong> {question.answer_guide}</p></details>)}
        </details>
      </article>)}</div>
    </div>}
  </section>;
}
