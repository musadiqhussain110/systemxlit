import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { EmptyState } from '../components/EmptyState';
import { dateTimeLabel } from '../utils/format';

export function NotificationsPage() {
  const notifications = useAsync(() => api.get('/notifications'), []);
  if (notifications.loading) return <Loader />;
  async function readAll() { await api.patch('/notifications/read-all'); await notifications.reload(); }
  async function read(id) { await api.patch(`/notifications/${id}/read`); await notifications.reload(); }
  return <><PageHeader eyebrow="Inbox" title="Notifications" subtitle="Approval updates, reminders, overdue alerts, return confirmations, and booking activity." actions={<button className="secondary-button" onClick={readAll}>Mark all read</button>} />{notifications.data?.length ? <div className="notification-list">{notifications.data.map((n) => <button key={n._id} className={`notification-item ${n.readAt ? '' : 'unread'}`} onClick={() => !n.readAt && read(n._id)}><div className="notification-dot" /><div><strong>{n.title}</strong><p>{n.message}</p><span>{dateTimeLabel(n.createdAt)}</span></div></button>)}</div> : <EmptyState title="You’re all caught up" text="Booking and resource alerts will appear here." />}</>;
}
