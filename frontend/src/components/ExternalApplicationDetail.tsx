import { InterviewTrackingPanel } from './InterviewTrackingPanel';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, Loader2, Save } from 'lucide-react';
import { applicationsApi, formatApiError } from '../services/api';
import { StatusBadge } from './StatusBadge';
import { InterviewPreparationPanel } from './InterviewPreparationPanel';
import type { Application } from '../types';

export function ExternalApplicationDetail({ application, onMoveToManual }: { application: Application; onMoveToManual: () => void }) {
  const [savedNotes, setSavedNotes] = useState(application.notes || '');
  const [notes, setNotes] = useState(savedNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [moving, setMoving] = useState(false);
  const moveToManual = async () => {
    setMoving(true); setError(''); setMessage('');
    try {
      await applicationsApi.moveToManual(application.id);
      onMoveToManual();
    } catch (err) {
      setError(formatApiError(err, 'Could not move this application to manual apply.'));
      setMoving(false);
    }
  };
  const [contact, setContact] = useState({
    contact_name: application.job?.contact_name || '',
    contact_email: application.job?.contact_email || '',
    contact_phone: application.job?.contact_phone || '',
  });
  const [contactDraft, setContactDraft] = useState(contact);
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const hasContact = Boolean(contact.contact_name || contact.contact_email || contact.contact_phone);
  const saveContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingContact(true); setContactError(''); setContactMessage('');
    try {
      const updated = await applicationsApi.update(application.id, {
        contact_name: contactDraft.contact_name.trim() || null,
        contact_email: contactDraft.contact_email.trim() || null,
        contact_phone: contactDraft.contact_phone.trim() || null,
      });
      setContact({
        contact_name: updated.job?.contact_name || '',
        contact_email: updated.job?.contact_email || '',
        contact_phone: updated.job?.contact_phone || '',
      });
      setEditingContact(false); setContactMessage('Contact details saved.');
    } catch (err) { setContactError(formatApiError(err, 'Could not save contact details.')); }
    finally { setSavingContact(false); }
  };
  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = await applicationsApi.update(application.id, { notes });
      setSavedNotes(updated.notes || ''); setMessage('Tracking notes saved.');
    } catch (err) { setError(formatApiError(err, 'Could not save your notes.')); }
    finally { setBusy(false); }
  };
  const job = application.job;
  return <div>
    <Link to="/applications" className="text-link" style={{ marginBottom: 18 }}><ArrowLeft size={14} /> All applications</Link>
    <div className="page-heading"><div><span className="eyebrow">Your application history</span><h1>{job?.title || 'Application details'}</h1><p>{job?.company}</p></div><div className="heading-actions"><StatusBadge status={application.status} /><a href="#interview-tracking" className="btn btn-secondary">Update progress</a><a href="#interview-preparation" className="btn btn-secondary">Prepare for interview</a></div></div>
    <div className="alert alert-success"><CheckCircle2 size={17} /><span>Submitted elsewhere and saved for tracking. No email was sent by JobApply.</span></div>
    {error && <div className="alert alert-danger" role="alert"><AlertCircle size={16} />{error}</div>}
    {message && <div className="alert alert-success" role="status"><CheckCircle2 size={16} />{message}</div>}
    <section className="card" style={{ marginBottom: 24 }}>
      <h2 className="card-title">Marked as applied elsewhere by mistake?</h2>
      <p className="card-subtitle">Move this application to a manual draft to choose your resume, write your message, and review the recruiter email. Your job details, saved contact, notes, and interview history are kept. The recorded external application date and method will be cleared. Email is sent only when you click Send application.</p>
      {(notes !== savedNotes || editingContact) && <p className="card-subtitle">Save your notes and save or cancel contact edits before moving.</p>}
      <button className="btn btn-secondary" type="button" disabled={moving || busy || savingContact || editingContact || notes !== savedNotes} onClick={moveToManual}>{moving && <Loader2 size={15} className="spinner" />}{moving ? 'Moving to manual apply…' : 'Move to manual apply'}</button>
    </section>
    <div className="review-layout"><section className="card">
      <h2 className="card-title">Application details</h2>
      <dl>
        <dt className="form-label">Applied on</dt><dd style={{ margin: '0 0 18px' }}>{application.applied_on ? new Date(application.applied_on + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not recorded'}</dd>
        <dt className="form-label">How you applied</dt><dd style={{ margin: '0 0 18px' }}>{application.application_method || 'Not recorded'}</dd>
      </dl>
      {job?.job_url && <a className="text-link" href={job.job_url} target="_blank" rel="noopener noreferrer">Listing / application link <ExternalLink size={14} /></a>}
      {job?.description && <><h2 className="card-title" style={{ marginTop: 24 }}>Job description</h2><div className="job-detail-description">{job.description}</div></>}
      <div className="form-group" style={{ marginTop: 24 }}><label htmlFor="tracking-notes" className="form-label">Tracking notes</label><textarea id="tracking-notes" className="form-textarea" rows={7} maxLength={50000} disabled={busy || moving} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Record updates, application references, or next steps…" /></div>
      <div className="review-save"><span>{notes !== savedNotes ? 'You have unsaved changes' : 'All notes saved'}</span><button className="btn btn-secondary" disabled={busy || moving || notes === savedNotes} onClick={save}>{busy ? <Loader2 size={15} className="spinner" /> : <Save size={15} />}Save notes</button></div>
    </section><aside className="card"><h2 className="card-title">HR / recruiter contact</h2><p className="card-subtitle">Contact details are optional for applications submitted elsewhere.</p>
      {contactMessage && <p className="alert alert-success" role="status">{contactMessage}</p>}
      {editingContact ? <form onSubmit={saveContact}>
        {contactError && <div className="alert alert-danger" role="alert">{contactError}</div>}
        <div className="form-group"><label htmlFor="recruiter-name" className="form-label">Contact name <span className="optional-label">Optional</span></label><input id="recruiter-name" className="form-input" autoComplete="name" maxLength={255} disabled={savingContact || moving} value={contactDraft.contact_name} onChange={e => setContactDraft({ ...contactDraft, contact_name: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="recruiter-email" className="form-label">Email <span className="optional-label">Optional</span></label><input id="recruiter-email" className="form-input" type="email" autoComplete="email" maxLength={255} disabled={savingContact || moving} value={contactDraft.contact_email} onChange={e => setContactDraft({ ...contactDraft, contact_email: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="recruiter-phone" className="form-label">Phone <span className="optional-label">Optional</span></label><input id="recruiter-phone" className="form-input" type="tel" autoComplete="tel" maxLength={100} disabled={savingContact || moving} value={contactDraft.contact_phone} onChange={e => setContactDraft({ ...contactDraft, contact_phone: e.target.value })} /></div>
        <div className="heading-actions"><button className="btn btn-primary" type="submit" disabled={savingContact || moving}>{savingContact ? <Loader2 size={15} className="spinner" /> : <Save size={15} />}Save contact</button><button className="btn btn-secondary" type="button" disabled={savingContact || moving} onClick={() => setEditingContact(false)}>Cancel</button></div>
      </form> : <>
        {contact.contact_name && <p>{contact.contact_name}</p>}
        {contact.contact_email && <p>{contact.contact_email}</p>}
        {contact.contact_phone && <p>{contact.contact_phone}</p>}
        {!hasContact && <p className="card-subtitle">No contact details recorded.</p>}
        <button className="btn btn-secondary" type="button" disabled={moving} onClick={() => { setContactDraft({ ...contact }); setContactError(''); setContactMessage(''); setEditingContact(true); }}>{hasContact ? 'Edit contact' : 'Add contact'}</button>
      </>}
    </aside></div>
    <InterviewTrackingPanel applicationId={application.id} />
    <InterviewPreparationPanel key={application.id} application={application} />
  </div>;
}
