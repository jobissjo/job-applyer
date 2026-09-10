import React, { useEffect, useState } from 'react';
import { User as UserIcon, Save, CheckCircle2 } from 'lucide-react';
import { profileApi } from '../services/api';
import { UserProfile } from '../types';

export const Profile: React.FC = () => {
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    name: '',
    phone: '',
    current_company: '',
    current_ctc: '',
    expected_ctc: '',
    location: '',
    years_of_experience: undefined,
    notice_period: '',
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
    additional_details: '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    profileApi
      .getProfile()
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleChange = (field: keyof UserProfile, value: any) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await profileApi.updateProfile(profile);
      setProfile(updated);
      setMessage({ type: 'success', text: 'Candidate profile updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Candidate Profile
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Your profile information (experience, current & expected CTC, notice period) is supplied to the LLM to ground matching and create tailored application cover letters.
        </p>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'}`}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ maxWidth: '900px' }}>
        <form onSubmit={handleSave}>
          <div className="card-title" style={{ marginBottom: '18px' }}>Personal & Contact Info</div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Alex Johnson"
                value={profile.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91 9876543210"
                value={profile.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Current Company</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Acme Technologies"
                value={profile.current_company || ''}
                onChange={(e) => handleChange('current_company', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location / City</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Kochi, Kerala or Remote"
                value={profile.location || ''}
                onChange={(e) => handleChange('location', e.target.value)}
              />
            </div>
          </div>

          <div className="card-title" style={{ marginTop: '24px', marginBottom: '18px' }}>Compensation & Availability</div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Current CTC</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 12 LPA"
                value={profile.current_ctc || ''}
                onChange={(e) => handleChange('current_ctc', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expected CTC</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 18 LPA"
                value={profile.expected_ctc || ''}
                onChange={(e) => handleChange('expected_ctc', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Years of Experience</label>
              <input
                type="number"
                step="0.5"
                min="0"
                className="form-input"
                placeholder="e.g. 3.5"
                value={profile.years_of_experience ?? ''}
                onChange={(e) => handleChange('years_of_experience', parseFloat(e.target.value) || undefined)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notice Period</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Immediate, 15 Days, or 1 Month"
              value={profile.notice_period || ''}
              onChange={(e) => handleChange('notice_period', e.target.value)}
            />
          </div>

          <div className="card-title" style={{ marginTop: '24px', marginBottom: '18px' }}>Online Profiles & Portfolio</div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">LinkedIn URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://linkedin.com/in/..."
                value={profile.linkedin_url || ''}
                onChange={(e) => handleChange('linkedin_url', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">GitHub URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://github.com/..."
                value={profile.github_url || ''}
                onChange={(e) => handleChange('github_url', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Portfolio / Website</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://yourportfolio.dev"
                value={profile.portfolio_url || ''}
                onChange={(e) => handleChange('portfolio_url', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Additional Candidate Highlights</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: '100px' }}
              placeholder="Highlight any core technologies, achievements, key open source projects, or certifications..."
              value={profile.additional_details || ''}
              onChange={(e) => handleChange('additional_details', e.target.value)}
            />
          </div>

          <div style={{ marginTop: '28px' }}>
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Save size={16} /> {saving ? 'Saving Profile...' : 'Save Profile Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
