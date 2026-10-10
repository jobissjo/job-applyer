import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, FileText, Loader2, Mail, PenLine } from 'lucide-react';
import { jobsApi, formatApiError } from '../services/api';

export function ManualApply() {
  const navigate = useNavigate();
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const inFlight = useRef(false);

  const changed = () => { requestId.current = crypto.randomUUID(); setError(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !role.trim() || !email.trim() || !description.trim()) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const job = await jobsApi.createManual({
        request_id: requestId.current,
        role: role.trim(), email: email.trim(), description: description.trim(),
        company: company.trim() || undefined, job_url: url.trim() || undefined,
      });
      navigate('/jobs/' + job.id);
    } catch (err) {
      setError(formatApiError(err, 'Could not save this opportunity. Please try again.'));
    } finally { inFlight.current = false; setBusy(false); }
  };

  return <div>
    <div className="page-heading"><div><span className="eyebrow">An opportunity you found</span><h1>Apply to any role.</h1><p>Bring a job you found elsewhere into your application workspace.</p></div><Link to="/applications" className="btn btn-secondary">Your applications <ArrowRight size={14} /></Link></div>
    <div className="review-layout">
      <form className="card" onSubmit={submit}>
        <span className="step-label"><span className="step-number">1</span>Add the opportunity</span>
        <h2 className="card-title">Tell us about the role</h2>
        <p className="card-subtitle">Enter the role, recruiter email, and job description. You will prepare your message next.</p>
        {error && <div className="alert alert-danger" role="alert"><AlertCircle size={16} />{error}</div>}
        <fieldset disabled={busy} style={{ border: 0, minWidth: 0 }}>
          <div className="form-group"><label htmlFor="manual-role" className="form-label">Role *</label><input id="manual-role" className="form-input" required maxLength={500} placeholder="e.g. Python developer" value={role} onChange={event => { changed(); setRole(event.target.value); }} /></div>
          <div className="form-group"><label htmlFor="manual-email" className="form-label">Recruiter email *</label><input id="manual-email" className="form-input" type="email" required maxLength={255} placeholder="careers@company.com" value={email} onChange={event => { changed(); setEmail(event.target.value); }} /></div>
          <div className="form-group"><label htmlFor="manual-description" className="form-label">Job description *</label><textarea id="manual-description" className="form-textarea" rows={10} required maxLength={50000} placeholder="Paste the responsibilities, requirements, and any details about the opportunity…" value={description} onChange={event => { changed(); setDescription(event.target.value); }} /></div>
          <div className="grid-2"><div className="form-group"><label htmlFor="manual-company" className="form-label">Company <span className="optional-label">Optional</span></label><input id="manual-company" className="form-input" maxLength={255} placeholder="Company name" value={company} onChange={event => { changed(); setCompany(event.target.value); }} /></div><div className="form-group"><label htmlFor="manual-url" className="form-label">Listing link <span className="optional-label">Optional</span></label><input id="manual-url" className="form-input" type="url" maxLength={1000} placeholder="https://…" value={url} onChange={event => { changed(); setUrl(event.target.value); }} /></div></div>
          <div className="review-save"><span>This opportunity is saved to your workspace.</span><button type="submit" className="btn btn-primary" disabled={busy || !role.trim() || !email.trim() || !description.trim()}>{busy ? <Loader2 size={15} className="spinner" /> : <ArrowRight size={15} />}{busy ? 'Saving opportunity…' : 'Continue to application'}</button></div>
        </fieldset>
      </form>
      <aside className="card"><span className="eyebrow">What comes next</span><h2 className="card-title" style={{ marginTop: 7 }}>Your opportunity. Your introduction.</h2>
        {[{ icon: PenLine, title: 'Add the role', text: 'Save the details from a listing, referral, or recruiter message.' }, { icon: FileText, title: 'Prepare your application', text: 'Choose a resume and write a cover letter yourself or with AI.' }, { icon: Mail, title: 'Review and send', text: 'Check the message and attachment, then send to the email you provided.' }].map(step => <div className="workflow-step" key={step.title}><span className="setup-icon"><step.icon size={15} /></span><div><strong>{step.title}</strong><p>{step.text}</p></div></div>)}
      </aside>
    </div>
  </div>;
}
