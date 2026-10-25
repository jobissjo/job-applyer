import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowUpRight } from 'lucide-react';
import { formatApiError } from '../services/api';
import { interviewsApi, progressLabels, trackingFilters, matchesTracking, nextInterview, roundNeedsUpdate, utcDate, type InterviewTracking, type TrackingFilter } from '../services/interviews';

export function Interviews() {
  const [data, setData] = useState<InterviewTracking[]>([]);
  const [filter, setFilter] = useState<TrackingFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    interviewsApi.list().then(value => { if (active) setData(value); })
      .catch(err => { if (active) setError(formatApiError(err, 'Could not load your interviews.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const visible = data.filter(item => matchesTracking(item, filter) && `${item.application.job?.company} ${item.application.job?.title}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div>
    <div className="page-heading"><div><span className="eyebrow">Every conversation is progress</span><h1>Interviews & outcomes</h1><p>Keep track of rounds, recruiter updates, and what you learned.</p></div><Link to="/applications" className="btn btn-secondary">All applications</Link></div>
    <section className="card">
      <div className="tracking-fields"><div className="form-group"><label className="form-label" htmlFor="interview-search">Search company or role</label><input id="interview-search" className="form-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Company or role…" /></div><div className="form-group"><label className="form-label" htmlFor="interview-filter">Show</label><select id="interview-filter" className="form-select" value={filter} onChange={e => setFilter(e.target.value as TrackingFilter)}>{Object.entries(trackingFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
      {loading ? <p role="status">Loading interviews…</p> : error ? <div className="alert alert-danger" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRetry(n => n + 1)}>Try again</button></div> : !visible.length ? <div className="empty-state"><CalendarDays size={30} /><h2>{data.length ? 'No matching applications' : 'Your interview journey starts here'}</h2><p>Open a sent application or one submitted elsewhere and update its progress or add an interview round.</p><Link to="/applications" className="btn btn-primary">Open applications</Link></div> : <div className="table-container"><table><thead><tr><th>Opportunity</th><th>Hiring progress</th><th>Next interview</th><th>Latest update</th><th>Views</th></tr></thead><tbody>{visible.map(item => {
        const next = nextInterview(item.rounds);
        const needsUpdate = item.rounds.some(r => roundNeedsUpdate(r));
        return <tr key={item.application.id}><td><Link className="table-job" to={`/applications/${item.application.id}`}>{item.application.job?.title}</Link><span className="table-company">{item.application.job?.company}</span></td><td><span className="learning-chip">{progressLabels[item.application.hiring_progress]}</span><span className="table-company">{item.rounds.length} round{item.rounds.length === 1 ? '' : 's'}{needsUpdate ? ' · Needs update' : ''}</span></td><td>{next ? <>{next.name}<span className="table-company">{utcDate(next.scheduled_at!).toLocaleString()}</span></> : 'No upcoming interview'}</td><td>{utcDate(item.application.updated_at).toLocaleDateString()}<span className="table-company">{item.history[0]?.description || 'Progress recorded'}</span></td><td><div className="heading-actions"><Link className="btn btn-secondary btn-sm" to={`/applications/${item.application.id}`}>View application <ArrowUpRight size={13} /></Link><Link className="btn btn-secondary btn-sm" to={`/interviews/${item.application.id}`}>View interview rounds <ArrowUpRight size={13} /></Link></div></td></tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}
