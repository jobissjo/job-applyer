import { progressLabels } from '../services/interviews';
import { TableSkeleton } from '../components/ListSkeleton';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, ArrowUpRight, Search, Send, Plus } from 'lucide-react';
import { applicationsApi, formatApiError } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import type { Application } from '../types';
const filters = [{ value: '', label: 'All applications' }, { value: 'ready', label: 'Ready to send' }, { value: 'sent', label: 'Sent' }, { value: 'applied_externally', label: 'Applied elsewhere' }, { value: 'hr_contact_required', label: 'Contact needed' }, { value: 'draft', label: 'Drafts' }, { value: 'failed', label: 'Failed' }];
const PAGE_SIZE = 10;
export const Applications: React.FC = () => {
  const [params,setParams] = useSearchParams();
  const status = filters.some(f=>f.value===params.get('status')) ? params.get('status') || '' : '';
  const requestedPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [applications,setApplications] = useState<Application[]>([]);
  const [total,setTotal] = useState(0);
  const [hasNext,setHasNext] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    let active=true; setLoading(true); setError('');
    applicationsApi.listPage({ status: status || undefined, page, limit: PAGE_SIZE }).then(data=>{
      if (!active) return;
      const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (page > lastPage) {
        setParams(status ? { status, page: String(lastPage) } : { page: String(lastPage) }, { replace: true });
        return;
      }
      setApplications(data.items); setTotal(data.total); setHasNext(data.has_next);
    })
      .catch(err=>{if(active)setError(formatApiError(err,'Could not load applications.'));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[status,page,retry,setParams]);
  const pagination = !error && total > 0 && <nav className="pagination" aria-label="Applications pagination">
    <button className="btn btn-secondary btn-sm" disabled={loading || page <= 1} onClick={()=>setParams(status?{status,page:String(page-1)}:{page:String(page-1)})}>Previous</button>
    <span aria-live="polite">Page {page} of {Math.max(1,Math.ceil(total/PAGE_SIZE))}</span>
    <button className="btn btn-secondary btn-sm" disabled={loading || !hasNext} onClick={()=>setParams(status?{status,page:String(page+1)}:{page:String(page+1)})}>Next</button>
  </nav>;
  return <div><div className="page-heading"><div><span className="eyebrow">Every step counts</span><h1>Your applications</h1><p>Prepare, review, and follow the progress of every opportunity.</p></div><div className="heading-actions"><Link to="/applications/add" className="btn btn-secondary"><Plus size={15} /> Add already applied</Link><Link to="/manual-apply" className="btn btn-primary"><Send size={15} /> Manual apply</Link><Link to="/jobs" className="btn btn-secondary"><Search size={15} /> Find your next role</Link></div></div>
    <div className="filter-tabs" aria-label="Filter applications">{filters.map(filter=><button key={filter.value} className={'filter-tab'+(status===filter.value?' active':'')} aria-pressed={status===filter.value} onClick={()=>setParams(filter.value?{status:filter.value}:{})}>{filter.label}</button>)}</div>
    {error && <div className="alert alert-danger" role="alert"><AlertCircle size={16} /><span>{error}</span><button className="btn btn-secondary btn-sm" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}
    <section className="card"><div className="section-header"><div><h2>{filters.find(f=>f.value===status)?.label}</h2><p>{loading?'Loading your activity…':error?'Activity unavailable':total+' applications'+(total>0?' · Showing '+((page-1)*PAGE_SIZE+1)+'–'+Math.min(page*PAGE_SIZE,total):'')}</p></div>{pagination}</div>
    {loading?<TableSkeleton columns={["Opportunity", "Resume", "Recruiter", "Status", "Updated", "Review"]} label="Loading applications…" />:error?null:applications.length===0?<div className="empty-state"><span className="empty-state-icon"><Send size={23} /></span><h3>{status?'Nothing here yet':'Your next application starts with a good fit'}</h3><p>{status?'Applications with this status will appear here.':'Explore a role, choose your resume, and prepare your introduction.'}</p><Link to="/jobs" className="btn btn-secondary">Explore opportunities <ArrowRight size={14} /></Link></div>:<div className="table-container"><table><thead><tr><th>Opportunity</th><th>Resume</th><th>Recruiter</th><th>Status</th><th>Updated</th><th><span className="sr-only">Review</span></th></tr></thead><tbody>{applications.map(app=><tr key={app.id}><td><Link className="table-job" to={'/applications/'+app.id}>{app.job?.title || 'Application #'+app.id}</Link><span className="table-company">{app.job?.company || 'Company unavailable'}</span></td><td>{app.resume?.title || (app.status==='applied_externally'?'Not recorded':'No resume selected')}</td><td>{app.sent_to || app.hr_contact?.email || app.job?.contact_email || (app.status==='applied_externally'?'Not recorded':<span style={{color:'var(--accent-amber)'}}>Contact needed</span>)}</td><td><StatusBadge status={app.status} />{['sent','applied_externally'].includes(app.status) && <span className="table-company">{progressLabels[app.hiring_progress]}</span>}</td><td>{new Date(app.sent_at || app.updated_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td><td><Link to={'/applications/'+app.id} className="btn btn-secondary btn-sm">{app.status==='sent'||app.status==='applied_externally'?'View':'Review'}<ArrowUpRight size={13} /></Link>{app.status==='sent' && <Link to={'/applications/'+app.id+'#follow-up'} className="btn btn-secondary btn-sm" style={{marginLeft:8}}>Follow up <Send size={12}/></Link>}</td></tr>)}</tbody></table></div>}{!loading && pagination}</section>
  </div>;
};
