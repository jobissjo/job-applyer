import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { applicationsApi, formatApiError } from '../services/api';

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function AddExternalApplication() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ role: '', company: '', applied_on: localToday(), application_method: 'Company website', contact_email: '', contact_name: '', contact_phone: '', job_url: '', description: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  const change = (field: keyof typeof form, value: string) => {
    setForm(previous => ({ ...previous, [field]: value }));
    requestId.current = crypto.randomUUID();
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !form.role.trim() || !form.company.trim() || !form.application_method.trim() || !form.applied_on) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const application = await applicationsApi.recordExternal({
        request_id: requestId.current,
        role: form.role.trim(), company: form.company.trim(), applied_on: form.applied_on,
        application_method: form.application_method.trim(),
        contact_email: form.contact_email.trim() || undefined,
        contact_name: form.contact_name.trim() || undefined,
        contact_phone: form.contact_phone.trim() || undefined,
        job_url: form.job_url.trim() || undefined,
        description: form.description.trim() || undefined, notes: form.notes.trim() || undefined,
      });
      navigate('/applications/' + application.id);
    } catch (err) { setError(formatApiError(err, 'Could not save this application. Please try again.')); }
    finally { inFlight.current = false; setBusy(false); }
  };

  return <div>
    <Link to="/applications" className="text-link" style={{ marginBottom: 18 }}><ArrowLeft size={14} /> All applications</Link>
    <div className="page-heading"><div><span className="eyebrow">Keep your search together</span><h1>Add an already submitted application</h1><p>Track a role you applied to through a website, referral, email, or any other way.</p></div></div>
    <div className="review-layout">
      <form className="card" onSubmit={submit}>
        <h2 className="card-title">Application details</h2>
        <p className="card-subtitle">Only the role, company, application date, and how you applied are required.</p>
        {error && <div className="alert alert-danger" role="alert"><AlertCircle size={16} />{error}</div>}
        <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
          <div className="grid-2">
            <div className="form-group"><label htmlFor="external-role" className="form-label">Role *</label><input id="external-role" className="form-input" required maxLength={500} value={form.role} onChange={e => change('role', e.target.value)} placeholder="e.g. Python developer" /></div>
            <div className="form-group"><label htmlFor="external-company" className="form-label">Company *</label><input id="external-company" className="form-input" required maxLength={255} value={form.company} onChange={e => change('company', e.target.value)} placeholder="Company name" /></div>
            <div className="form-group"><label htmlFor="external-date" className="form-label">Applied on *</label><input id="external-date" className="form-input" type="date" required value={form.applied_on} onChange={e => change('applied_on', e.target.value)} /></div>
            <div className="form-group"><label htmlFor="external-method" className="form-label">How you applied *</label><input id="external-method" className="form-input" required maxLength={255} list="application-methods" value={form.application_method} onChange={e => change('application_method', e.target.value)} placeholder="Website, referral, LinkedIn…" /><datalist id="application-methods">{['Company website', 'LinkedIn', 'Job portal', 'Referral', 'Email', 'In person'].map(method => <option key={method} value={method} />)}</datalist></div>
          </div>
          <div className="form-group"><label htmlFor="external-url" className="form-label">Listing or application link <span className="optional-label">Optional</span></label><input id="external-url" className="form-input" type="url" maxLength={1000} value={form.job_url} onChange={e => change('job_url', e.target.value)} placeholder="https://…" /></div>
          <div className="grid-2">
            <div className="form-group"><label htmlFor="external-email" className="form-label">HR / recruiter email <span className="optional-label">Optional</span></label><input id="external-email" className="form-input" type="email" maxLength={255} value={form.contact_email} onChange={e => change('contact_email', e.target.value)} /></div>
            <div className="form-group"><label htmlFor="external-name" className="form-label">Contact name <span className="optional-label">Optional</span></label><input id="external-name" className="form-input" maxLength={255} value={form.contact_name} onChange={e => change('contact_name', e.target.value)} /></div>
          </div>
          <div className="form-group"><label htmlFor="external-phone" className="form-label">Contact phone <span className="optional-label">Optional</span></label><input id="external-phone" className="form-input" type="tel" maxLength={100} value={form.contact_phone} onChange={e => change('contact_phone', e.target.value)} /></div>
          <div className="form-group"><label htmlFor="external-description" className="form-label">Job description <span className="optional-label">Optional</span></label><textarea id="external-description" className="form-textarea" rows={5} maxLength={50000} value={form.description} onChange={e => change('description', e.target.value)} /></div>
          <div className="form-group"><label htmlFor="external-notes" className="form-label">Tracking notes <span className="optional-label">Optional</span></label><textarea id="external-notes" className="form-textarea" rows={4} maxLength={50000} value={form.notes} onChange={e => change('notes', e.target.value)} placeholder="Application reference, next steps, or anything to remember…" /></div>
          <div className="review-save"><span>Save to your application history.</span><button type="submit" className="btn btn-primary" disabled={busy || !form.role.trim() || !form.company.trim() || !form.applied_on || !form.application_method.trim()}>{busy ? <Loader2 size={15} className="spinner" /> : <Plus size={15} />}{busy ? 'Saving application…' : 'Save application'}</button></div>
        </fieldset>
      </form>
      <aside className="card"><CheckCircle2 size={23} color="var(--primary)" /><h2 className="card-title" style={{ marginTop: 12 }}>Already applied? Keep a record.</h2><p className="card-subtitle">This saves a tracking record without sending or scheduling an email. You do not need an HR contact, resume, cover letter, or email setup.</p><p className="card-subtitle">Find it later using the Applied elsewhere filter in Your applications, and update your notes as things progress.</p></aside>
    </div>
  </div>;
}
