import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ExternalLink, ArrowRight, UserCheck, AlertCircle } from 'lucide-react';
import { jobsApi } from '../services/api';
import { Job } from '../types';

export const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await jobsApi.list({
        query: query.trim() || undefined,
        source: source || undefined,
        page,
        limit: 12,
      });
      setJobs(data.items);
      setTotal(data.total);
      setHasNext(data.has_next);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, source]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Job Discovery
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Search local database of scraped opportunities from Infopark and Technopark ({total} total).
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by title, skills, or company (e.g. Python, FastAPI, React)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select
              className="form-select"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Sources</option>
              <option value="infopark">Infopark (Kochi)</option>
              <option value="technopark">Technopark (Tvm)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary">
            <Search size={16} /> Search
          </button>
        </form>
      </div>

      {/* Job Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
            No jobs found matching your criteria.
          </p>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
            Run the scraper CLI scripts (<code>python scripts/run_scrapers.py</code>) to pull fresh listings.
          </div>
        </div>
      ) : (
        <div className="grid-3" style={{ marginBottom: '32px' }}>
          {jobs.map((job) => (
            <div key={job.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="badge badge-source">{job.source.toUpperCase()}</span>
                {job.has_hr_contact ? (
                  <span className="badge badge-ready" title="HR contact email is available">
                    HR Contact Available
                  </span>
                ) : (
                  <span className="badge badge-hr_contact_required" title="No HR email found on listing">
                    HR Required
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px', lineHeight: 1.3 }}>
                {job.title}
              </h2>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '8px' }}>
                {job.company}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '16px' }}>
                {job.location || 'Kerala, India'}
              </div>

              <p
                style={{
                  fontSize: '0.86rem',
                  color: 'var(--text-muted)',
                  flex: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                {job.description || job.requirements || 'No description provided.'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                  {job.posted_date ? `Posted: ${job.posted_date}` : 'Recently scraped'}
                </span>
                <Link to={`/jobs/${job.id}`} className="btn btn-secondary btn-sm">
                  View & Apply <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Page {page}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={!hasNext}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};
