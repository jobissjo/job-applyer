import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { learningApi, formatApiError } from '../services/api';
import type { LearningEntry, LearningItem, LearningStatus } from '../types';

const statuses: Record<LearningStatus, string> = { planned: 'Planned', in_progress: 'In progress', completed: 'Completed', on_hold: 'On hold' };

function EntryEditor({ itemId, entry, busy, save, cancel }: {
  itemId: number; entry?: LearningEntry; busy: boolean;
  save: (data: Pick<LearningEntry, 'kind' | 'content' | 'url'>, id?: number) => Promise<boolean>;
  cancel?: () => void;
}) {
  const [kind, setKind] = useState<'note' | 'resource'>(entry?.kind || 'note');
  const [content, setContent] = useState(entry?.content || '');
  const [url, setUrl] = useState(entry?.url || '');
  const prefix = `entry-${itemId}-${entry?.id || 'new'}`;
  return <form className="learning-entry-form" onSubmit={async e => {
    e.preventDefault();
    if (await save({ kind, content: content.trim(), url: kind === 'resource' ? url : null }, entry?.id)) {
      setContent(''); setUrl(''); cancel?.();
    }
  }}>
    <label className="form-label" htmlFor={`${prefix}-kind`}>{entry ? 'Edit entry' : 'Add a note or resource'}</label>
    <select id={`${prefix}-kind`} className="form-select" value={kind} onChange={e => setKind(e.target.value as typeof kind)} disabled={busy}><option value="note">Note</option><option value="resource">Resource</option></select>
    <label className="form-label" htmlFor={`${prefix}-content`}>{kind === 'note' ? 'Your note' : 'Resource title / description'}</label>
    <textarea id={`${prefix}-content`} className="form-textarea" rows={3} required maxLength={10000} value={content} onChange={e => setContent(e.target.value)} disabled={busy} />
    {kind === 'resource' && <><label className="form-label" htmlFor={`${prefix}-url`}>Resource URL</label><input id={`${prefix}-url`} type="url" pattern="https?://.*" className="form-input" placeholder="https://…" maxLength={2000} required value={url} onChange={e => setUrl(e.target.value)} disabled={busy} /></>}
    <div className="learning-actions"><button className="btn btn-primary btn-sm" disabled={busy || !content.trim()}>{entry ? 'Save entry' : 'Add entry'}</button>{cancel && <button type="button" className="btn btn-secondary btn-sm" onClick={cancel} disabled={busy}>Cancel</button>}</div>
  </form>;
}

export function Learning() {
  const [params] = useSearchParams();
  const [items, setItems] = useState<LearningItem[]>([]);
  const [selected, setSelected] = useState(Number(params.get('item')) || 0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [skill, setSkill] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const load = () => { setLoading(true); setError(''); learningApi.list().then(setItems).catch(err => setError(formatApiError(err))).finally(() => setLoading(false)); };
  useEffect(load, []);
  useEffect(() => { setEditing(null); setConfirmDelete(false); }, [selected]);
  const run = async (work: () => Promise<void>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true); setError('');
    try { await work(); return true; } catch (err) { setError(formatApiError(err)); return false; } finally { setBusy(false); }
  };
  const replace = (item: LearningItem) => setItems(old => [item, ...old.filter(other => other.id !== item.id)]);
  const current = items.find(item => item.id === selected);
  const visible = items.filter(item => (!filter || item.status === filter) && `${item.skill} ${item.jobs.map(job => `${job.title} ${job.company}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <div>
    <div className="page-heading"><div><span className="eyebrow">Your next skill starts here</span><h1>Learning</h1><p>Turn job requirements into a learning plan. Keep your notes, resources, and progress together.</p></div><BookOpen size={28} /></div>
    {error && <div className="alert alert-danger" role="alert">{error}<button className="btn btn-secondary btn-sm" disabled={busy} onClick={load}>Reload</button></div>}
    <div className="learning-summary">{items.length} skills <span>·</span> {items.filter(item => item.status === 'in_progress').length} in progress <span>·</span> {items.filter(item => item.status === 'completed').length} completed</div>
    <form className="card" onSubmit={e => { e.preventDefault(); void run(async () => { const saved = await learningApi.create(skill.trim()); replace(saved); setSelected(saved.id); setSkill(''); }); }}>
      <label className="form-label" htmlFor="new-learning-skill">Add a skill to learn</label><div className="contact-form"><input id="new-learning-skill" className="form-input" placeholder="e.g. Docker, system design, PostgreSQL" value={skill} required maxLength={150} onChange={e => setSkill(e.target.value)} disabled={busy} /><button className="btn btn-primary" disabled={busy || !skill.trim()}><Plus size={15} />Add skill</button></div>
      <p className="card-subtitle" style={{ marginTop: 10 }}>To link a skill to a job, open that job or application and use Add / link. Repeated names reuse your existing learning item.</p>
    </form>
    <div className="learning-workspace">
      <section className="card"><label className="form-label" htmlFor="learning-search">Search skills or linked jobs</label><input id="learning-search" className="form-input" type="search" value={query} onChange={e => setQuery(e.target.value)} />
        <label className="form-label" style={{ marginTop: 12 }} htmlFor="learning-filter">Learning status</label><select id="learning-filter" className="form-select" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All statuses</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        {loading ? <p role="status">Loading learning items…</p> : visible.length === 0 ? <p className="card-subtitle" style={{ marginTop: 20 }}>{items.length ? 'No skills match these filters.' : 'Add your first skill above, or find skill gaps on a job.'}</p> : <div className="learning-list">{visible.map(item => <button key={item.id} className={'learning-list-item' + (selected === item.id ? ' selected' : '')} aria-pressed={selected === item.id} disabled={busy} onClick={() => setSelected(item.id)}><strong>{item.skill}</strong><span>{statuses[item.status]} · {item.jobs.length} jobs · {item.entries.length} entries</span></button>)}</div>}
      </section>
      {current ? <section className="card" aria-label={`${current.skill} learning details`}>
        <div className="section-header"><div><span className="eyebrow">Learning details</span><h2>{current.skill}</h2></div><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} />Delete skill</button></div>
        {confirmDelete && <div className="alert alert-warning"><span>Delete this skill, its notes, resources, and job links?</span><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(async () => { await learningApi.delete(current.id); setItems(old => old.filter(item => item.id !== current.id)); setSelected(0); })}>Delete</button><button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep skill</button></div>}
        <label htmlFor="learning-status" className="form-label">Progress</label><select id="learning-status" className="form-select" value={current.status} disabled={busy} onChange={e => void run(async () => replace(await learningApi.update(current.id, e.target.value as LearningStatus)))}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <h3 className="learning-subheading">Linked jobs ({current.jobs.length})</h3>
        {current.jobs.length === 0 && <p className="card-subtitle">No jobs linked yet. Open a job and add this skill to connect it.</p>}
        {current.jobs.map(job => <div className="learning-gap" key={job.id}><Link className="text-link" to={`/jobs/${job.id}`}>{job.title} · {job.company}</Link><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(async () => { await learningApi.unlink(current.id, job.id); replace({ ...current, jobs: current.jobs.filter(other => other.id !== job.id) }); })}>Unlink</button></div>)}
        <h3 className="learning-subheading">Notes & resources ({current.entries.length})</h3>
        {current.entries.map(entry => editing === entry.id ? <EntryEditor key={entry.id} itemId={current.id} entry={entry} busy={busy} cancel={() => setEditing(null)} save={(data, id) => run(async () => replace(await learningApi.saveEntry(current.id, data, id)))} /> : <article className="learning-entry" key={entry.id}><span className="eyebrow">{entry.kind}</span><p>{entry.content}</p>{entry.url && <a href={entry.url} className="text-link" target="_blank" rel="noopener noreferrer">Open resource ↗</a>}<div className="learning-actions"><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setEditing(entry.id)}>Edit</button><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(async () => { await learningApi.deleteEntry(current.id, entry.id); replace({ ...current, entries: current.entries.filter(other => other.id !== entry.id) }); })}>Remove</button></div></article>)}
        <EntryEditor key={current.id} itemId={current.id} busy={busy} save={data => run(async () => replace(await learningApi.saveEntry(current.id, data)))} />
      </section> : <section className="card empty-state"><BookOpen size={30} /><h2>Make room for your next skill</h2><p>Select a skill to manage its progress, linked jobs, notes, and resources.</p></section>}
    </div>
  </div>;
}
