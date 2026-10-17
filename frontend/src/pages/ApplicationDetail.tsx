import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2, Save, Send } from 'lucide-react';
import { applicationsApi, resumesApi, formatApiError } from '../services/api';
import { FollowUpPanel } from '../components/FollowUpPanel';
import { LearningPanel } from '../components/LearningPanel';
import { StatusBadge } from '../components/StatusBadge';
import type { Application, Resume } from '../types';
export const ApplicationDetail: React.FC = () => {
  const {id} = useParams();
  const appId=Number(id);
  const [application,setApplication]=useState<Application|null>(null);
  const [resumes,setResumes]=useState<Resume[]>([]);
  const [resumeId,setResumeId]=useState<number|undefined>();
  const [subject,setSubject]=useState('');
  const [body,setBody]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<'save'|'send'|'schedule'|'cancel'|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [sendAt,setSendAt]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    Promise.all([applicationsApi.get(appId),resumesApi.list()]).then(([app,list])=>{
      if(!active)return;setApplication(app);setResumes(list);setResumeId(app.resume_id || undefined);setSubject(app.email_subject||'Application for '+app.job?.title);setBody(app.cover_letter?.content||'');
    }).catch(err=>{if(active)setError(formatApiError(err,'Could not load this application.'));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[appId,retry]);
  const save = () => applicationsApi.update(appId,{ resume_id:resumeId ?? null,email_subject:subject,cover_letter_content:body });
  const saveDraft=async()=>{
    setBusy('save');setError('');setMessage('');
    try{setApplication(await save());setMessage('Your changes are saved.');}catch(err){setError(formatApiError(err,'Could not save your changes.'));}finally{setBusy(null);}
  };
  const send=async()=>{
    setBusy('send');setError('');setMessage('');
    try{
      await save();
      const app=await applicationsApi.send(appId);setApplication(app);
      if(app.status==='sent')setMessage('Application sent to '+app.sent_to+'.');
      else setError('Your application was not sent. '+(app.notes||'Check your email connection and try again.'));
    }catch(err){setError(formatApiError(err,'Could not send this application.'));}finally{setBusy(null);}
  };
  const scheduleSend=async()=>{
    if(!sendAt || new Date(sendAt).getTime()<=Date.now()){setError('Choose a future date and time.');return;}
    setBusy('schedule');setError('');setMessage('');
    try{await save();const app=await applicationsApi.schedule(appId,new Date(sendAt).toISOString());setApplication(app);setMessage('Application scheduled.');}
    catch(err){setError(formatApiError(err,'Could not schedule this application.'));}finally{setBusy(null);}
  };
  const cancelSchedule=async()=>{
    setBusy('cancel');setError('');setMessage('');
    try{setApplication(await applicationsApi.cancelSchedule(appId));setMessage('Schedule cancelled. You can edit or send now.');}
    catch(err){setError(formatApiError(err,'Could not cancel this schedule.'));}finally{setBusy(null);}
  };
  if(loading)return <div className="loading-state" role="status">Loading your applicationâ€¦</div>;
  if(!application)return <div className="card empty-state"><h1>Application unavailable</h1><p>{error}</p><button className="btn btn-secondary" onClick={()=>setRetry(n=>n+1)}>Try again</button><Link className="text-link" to="/applications" style={{marginLeft:16}}>Back to applications</Link></div>;
  const sent=application.status==='sent';
  const scheduled=application.status==='scheduled';
  const locked=sent||scheduled||application.status==='sending';
  const recipient=application.sent_to || application.hr_contact?.email || application.job?.contact_email;
  const canSend=!!recipient && !locked && !!subject.trim() && !!body.trim();
  const dirty=subject!==(application.email_subject||'') || body!==(application.cover_letter?.content||'') || (resumeId || null)!==(application.resume_id || null);
  return <div><Link to="/applications" className="text-link" style={{marginBottom:18}}><ArrowLeft size={14} /> All applications</Link><div className="page-heading"><div><span className="eyebrow">Make a thoughtful introduction</span><h1>{sent?'Your sent application':'Review your application'}</h1><p>{application.job?.title} Â· {application.job?.company}</p></div><div className="heading-actions"><StatusBadge status={application.status} />{sent && <a href="#follow-up" className="btn btn-primary"><Send size={15} /> Follow up</a>}</div></div>
    {error&&<div className="alert alert-danger" role="alert"><AlertCircle size={16}/>{error}</div>}{message&&<div className="alert alert-success" role="status"><CheckCircle2 size={16}/>{message}</div>}
    {sent&&<div className="alert alert-success"><CheckCircle2 size={17}/><span>Sent to <strong>{recipient}</strong>{application.sent_at?' on '+new Date(application.sent_at).toLocaleString('en-IN'):''}.</span></div>}
    {scheduled&&<div className="alert alert-success"><span>Scheduled for {application.scheduled_at?new Date(application.scheduled_at.endsWith('Z')?application.scheduled_at:application.scheduled_at+'Z').toLocaleString('en-IN'):''}. Cancel to edit.</span><button className="btn btn-secondary" disabled={!!busy} onClick={cancelSchedule}>Cancel schedule</button></div>}
    <div className="review-layout"><section className="card"><span className="step-label"><span className="step-number">1</span>Your message</span><h2 className="card-title">A good first impression</h2><p className="card-subtitle">Review the subject and cover letter that will be sent to the recruiter.</p><div className="form-group"><label className="form-label" htmlFor="review-to">To</label><input id="review-to" className="form-input" readOnly value={recipient||'Recruiter contact needed'}/></div><div className="form-group"><label className="form-label" htmlFor="review-subject">Subject</label><input id="review-subject" className="form-input" disabled={locked||!!busy} value={subject} onChange={e=>setSubject(e.target.value)}/></div><div className="form-group"><label className="form-label" htmlFor="review-body">Cover letter</label><textarea id="review-body" className="form-textarea cover-letter-editor" disabled={locked||!!busy} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your introduction hereâ€¦"/></div>{!locked&&<div className="review-save"><span>{dirty?'You have unsaved changes':'All changes saved'}</span><button className="btn btn-secondary" disabled={!!busy||!dirty} onClick={saveDraft}>{busy==='save'?<Loader2 size={15} className="spinner"/>:<Save size={15}/>}Save draft</button></div>}</section>
    <aside className="dashboard-aside"><section className="card"><span className="step-label"><span className="step-number">2</span>Your resume</span><h2 className="card-title">Bring the right experience</h2><p className="card-subtitle">Choose the resume to attach to this application.</p><label className="form-label" htmlFor="review-resume">Attached resume</label><select id="review-resume" className="form-select" disabled={locked||!!busy} value={resumeId||''} onChange={e=>setResumeId(Number(e.target.value)||undefined)}><option value="">No resume attached</option>{resumes.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>{resumeId&&<div className="resume-attachment"><FileText size={18}/><span>{resumes.find(r=>r.id===resumeId)?.file_name||application.resume?.file_name}</span></div>}</section>
    {!locked&&<section className="card"><span className="step-label"><span className="step-number">3</span>The final check</span><h2 className="card-title">Ready for your next move?</h2><p className="card-subtitle">Sending saves your latest edits and emails this message to the recruiter with your selected resume.</p>{!recipient?<div className="alert alert-warning">Add a recruiter contact before sending.</div>:null}{!body.trim()?<p className="card-subtitle">Add a cover letter to complete your message.</p>:null}{!resumeId?<p className="card-subtitle">No resume is attached.</p>:null}<button onClick={send} className="btn btn-primary" style={{width:'100%'}} disabled={!canSend||!!busy}>{busy==='send'?<Loader2 size={15} className="spinner"/>:<Send size={15}/>} {busy==='send'?'Sending applicationâ€¦':'Send application'}</button><div className="form-group" style={{marginTop:16}}><label htmlFor="send-at" className="form-label">Schedule send ({Intl.DateTimeFormat().resolvedOptions().timeZone})</label><input id="send-at" className="form-input" type="datetime-local" disabled={!!busy} value={sendAt} onChange={e=>setSendAt(e.target.value)}/></div><button onClick={scheduleSend} className="btn btn-secondary" style={{width:'100%'}} disabled={!canSend||!!busy||!sendAt}>{busy==='schedule'?'Scheduling…':'Schedule send'}</button>{!recipient&&<Link to="/hr-contacts" className="text-link" style={{marginTop:16}}>Add recruiter contact <ArrowRight size={13}/></Link>}</section>}</aside></div>
    {sent && <FollowUpPanel key={application.id} application={application} />}
    <LearningPanel jobId={application.job_id} resumeId={resumeId} />
  </div>;
};
