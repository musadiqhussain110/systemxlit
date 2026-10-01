import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { dateTimeLabel } from '../utils/format';

export function ActivityPage() {
  const activity = useAsync(() => api.get('/activity?limit=150'), []);
  if (activity.loading) return <Loader />;
  return <><PageHeader eyebrow="Audit trail" title="Booking activity history" subtitle="Monitor booking requests, approval decisions, cancellations, issue events, and returns." />{activity.error && <div className="alert error" role="alert">{activity.error}</div>}<div className="timeline">{(activity.data || []).map((x) => <div className="timeline-row" key={x._id}><div className="timeline-point" /><div><strong>{x.action.replace('.', ' · ')}</strong><p>{x.actor?.name || 'System'} · {x.entityType}</p><span>{dateTimeLabel(x.createdAt)}</span></div></div>)}</div></>;
}
