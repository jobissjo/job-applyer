import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { InterviewTrackingPanel } from '../components/InterviewTrackingPanel';

export function InterviewDetail() {
  const { id } = useParams();
  const applicationId = Number(id);
  return <div>
    <Link to="/interviews" className="text-link"><ArrowLeft size={14} /> All interviews</Link>
    <div className="page-heading"><div><span className="eyebrow">Every conversation is progress</span><h1>Interview rounds</h1><p>Manage interview schedules, results, feedback, and notes.</p></div></div>
    <InterviewTrackingPanel key={applicationId} applicationId={applicationId} roundsOnly />
  </div>;
}
