import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles } from 'lucide-react';
import { learningApi, formatApiError } from '../services/api';
import type { LearningItem, SkillGap } from '../types';

export function LearningPanel({ jobId, resumeId }: { jobId: number; resumeId?: number }) {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [gaps, setGaps] = useState<SkillGap[] | null>(null);
  const [skill, setSkill] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const version = useRef(0);
  useEffect(() => {
    const current = ++version.current;
    setGaps(null); setError(''); setMessage(''); setItems([]); setBusy(false);
    learningApi.list().then(data => { if (version.current === current) setItems(data); })
      .catch(err => { if (version.current === current) setError(formatApiError(err)); });
    return () => { version.current++; };
  }, [jobId, resumeId]);
  const run = async (work: (current: number) => Promise<void>) => {
    if (busy) return;
    const current = version.current;
    setBusy(true); setError(''); setMessage('');
    try { await work(current); } catch (err) { if (version.current === current) setError(formatApiError(err)); }
    finally { if (version.current === current) setBusy(false); }
  };
  const add = (name: string) => run(async current => {
    const saved = await learningApi.create(name, [jobId]);
    if (version.current !== current) return;
    setItems(old => [...old.filter(item => item.id !== saved.id), saved]); setSkill('');
    setMessage(`${saved.skill} is linked to this job in Learning.`);
  });
  return <section className="card learning-panel">
    <div className="section-header"><div><h2><BookOpen size={17} /> Build your skills</h2><p>Keep track of skills you want to learn for this role.</p></div><Link to="/learning" className="text-link">Open Learning</Link></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <div className="alert alert-success" role="status">{message}</div>}
    <button type="button" className="btn btn-secondary" disabled={busy || !resumeId} onClick={() => void run(async current => {
      const result = await learningApi.gaps(jobId, resumeId!);
      if (version.current === current) setGaps(result);
    })}><Sparkles size={14} />{busy ? 'Working…' : 'Find skill gaps'}</button>
    <p className="card-subtitle" style={{ marginTop: 10 }}>{resumeId ? 'Compares your selected resume and profile details. Review suggestions before saving.' : 'Select a resume to compare it with this job, or add a skill below.'}</p>
    {gaps && <div aria-live="polite">{gaps.length === 0 && <p>No missing skills were identified in this comparison.</p>}{gaps.map((gap, index) => <div className="learning-gap" key={`${gap.skill}-${index}`}><div><strong>{gap.skill}</strong><p>{gap.reason}</p></div><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void add(gap.skill)}>Add / link</button></div>)}</div>}
    <form onSubmit={e => { e.preventDefault(); void add(skill.trim()); }}>
      <label className="form-label" htmlFor={`learning-skill-${jobId}`}>Add or link a skill</label>
      <div className="contact-form"><input id={`learning-skill-${jobId}`} className="form-input" list={`learning-existing-${jobId}`} maxLength={150} required placeholder="e.g. Docker" value={skill} onChange={e => setSkill(e.target.value)} disabled={busy} /><button className="btn btn-secondary" disabled={busy || !skill.trim()}>Add / link</button></div>
      <datalist id={`learning-existing-${jobId}`}>{items.map(item => <option key={item.id} value={item.skill} />)}</datalist>
      <p className="card-subtitle" style={{ marginTop: 8 }}>An existing skill keeps its progress and gains a link to this job.</p>
    </form>
    {items.filter(item => item.jobs.some(job => job.id === jobId)).map(item => <Link className="learning-chip" key={item.id} to={`/learning?item=${item.id}`}>{item.skill} · {item.status.replace(/_/g, ' ')}</Link>)}
  </section>;
}
