import { CardListSkeleton } from '../components/ListSkeleton';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Briefcase, Check, MapPin, Search, Zap } from 'lucide-react';
import { jobsApi, formatApiError } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import type { Job } from '../types';

export const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    jobsApi.list({ query: search || undefined, source: source || undefined, page, limit: 12 }).then(data => {
      if (!active) return;
      setJobs(data.items); setTotal(data.total); setHasNext(data.has_next);
    }).catch(err => { if (active) setError(formatApiError(err, 'Could not load jobs. Please try again.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, source, search, retry]);
  const onSearch = (event: React.FormEvent) => { event.preventDefault(); setSearch(query.trim()); setPage(1); setRetry(n => n+1); };
  return <div>
    <div className="page-heading"><div><span className="eyebrow">Find your next opportunity</span><h1>A role that feels right.</h1><p>Explore job listings and the opportunities you added yourself.</p></div><div className="heading-actions"><Link to="/manual-apply" className="btn btn-primary">Manual apply <ArrowRight size={14} /></Link><Link to="/auto-apply" className="btn btn-secondary"><Zap size={15} /> Auto apply</Link></div></div>
    <form className="card search-toolbar" onSubmit={onSearch}><div className="search-input"><Search size={18} /><input aria-label="Search job titles, skills, or companies" className="form-input" placeholder="Job title, skill, or company…" value={query} onChange={e => setQuery(e.target.value)} /></div><select aria-label="Job source" className="form-select" value={source} onChange={e => { setSource(e.target.value); setPage(1); }}><option value="">All sources</option><option value="infopark">Infopark · Kochi</option><option value="technopark">Technopark · Trivandrum</option><option value="manual">My manual entries</option></select><button className="btn btn-primary" type="submit">Search jobs <ArrowRight size={14} /></button></form>
    {error && <div className="alert alert-danger" role="alert"><AlertCircle size={17} /><span>{error}</span><button className="btn btn-secondary btn-sm" onClick={() => setRetry(n => n+1)}>Retry</button></div>}
    <div className="results-heading"><span>{loading ? 'Finding opportunities…' : error ? 'Results unavailable' : total + (total === 1 ? ' opportunity' : ' opportunities')}{search && ' for “' + search + '”'}</span><span>Infopark & Technopark</span></div>
    {loading ? <CardListSkeleton /> : error ? null : jobs.length === 0 ? <div className="card empty-state"><span className="empty-state-icon"><Briefcase size={24} /></span><h2>{search || source ? 'No matches this time' : 'Your opportunity board is ready'}</h2><p>{search || source ? 'Try another keyword or look across both sources.' : 'Discover new listings through Auto apply. That workflow can also send applications, so review its settings before starting.'}</p>{search || source ? <button className="btn btn-secondary" onClick={() => { setQuery(''); setSearch(''); setSource(''); setPage(1); }}>Clear filters</button> : <Link to="/auto-apply" className="btn btn-primary">Open Auto apply <ArrowRight size={14} /></Link>}</div> :
      <div className="grid-3">{jobs.map(job => <article key={job.id} className="card job-card"><div className="job-card-top"><div className="company-avatar" aria-hidden="true">{job.company.split(/\s+/).slice(0,2).map(word => word.charAt(0)).join('').toUpperCase()}</div><span className="badge badge-source">{job.source === 'infopark' ? 'Infopark' : job.source === 'technopark' ? 'Technopark' : job.source === 'manual' ? 'Manual entry' : job.source}</span></div><h2><Link to={'/jobs/' + job.id}>{job.title}</Link></h2><div className="job-company">{job.company}</div><div className="job-location"><MapPin size={12} />{job.location || 'Location not listed'}</div><p className="job-description">{job.description || job.requirements || 'Open this opportunity to see the available details.'}</p><div className="job-card-footer">{job.is_applied ? <StatusBadge status={job.application_status || 'sent'} /> : job.has_hr_contact ? <span className="badge badge-matched"><Check size={11} /> Contact available</span> : <StatusBadge status="hr_contact_required" />}<Link to={'/jobs/' + job.id} className="btn btn-secondary btn-sm">View job <ArrowRight size={13} /></Link></div></article>)}</div>}
    {!error && !loading && total > 0 && <div className="pagination"><button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1,p-1))}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/12))}</span><button className="btn btn-secondary btn-sm" disabled={!hasNext} onClick={() => setPage(p => p+1)}>Next</button></div>}
  </div>;
};
