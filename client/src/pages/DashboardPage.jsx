import { Link } from 'react-router-dom';
import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { Loader } from '../components/Loader';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../context/AuthContext';
import { dateLabel } from '../utils/format';

export function DashboardPage() {
  const { user, isStaff, canBook, can } = useAuth();
  const canAnalyze = can('analytics.read');
  const analytics = useAsync(() => canAnalyze ? api.get('/analytics/summary') : Promise.resolve(null), [canAnalyze]);
  const bookings = useAsync(() => api.get('/bookings'), []);
  if (analytics.loading || bookings.loading) return <Loader />;
  const rows = bookings.data || [];
  const totals = analytics.data?.totals || { total: rows.length, pending: rows.filter(row => row.status === 'pendingApproval').length, approved: rows.filter(row => row.approvalStatus === 'approved').length, cancelled: rows.filter(row => row.status === 'cancelled').length, currentlyIssued: rows.filter(row => ['inUse', 'overdue'].includes(row.status)).length };
  const upcoming = (bookings.data || []).filter((b) => !['cancelled', 'rejected', 'completed', 'damaged', 'returnedLate'].includes(b.status)).sort((a, b) => `${a.bookingDate} ${a.startTime}`.localeCompare(`${b.bookingDate} ${b.startTime}`)).slice(0, 5);

  return <>
    <PageHeader eyebrow="Overview" title={`Good day, ${user.name.split(' ')[0]}`} subtitle="Here’s what is happening with your university resources." actions={canBook ? <Link className="primary-button" to="/book">+ New booking</Link> : <Link className="primary-button" to={user.role === 'admin' ? '/activity' : '/bookings'}>{user.role === 'admin' ? 'Monitor booking activity ↗' : 'Review booking requests ↗'}</Link>} />
    {(analytics.error || bookings.error) && <div className="alert error" role="alert">{analytics.error || bookings.error}</div>}
    <section className="dashboard-welcome"><div><span className="eyebrow">YOUR CAMPUS, CONNECTED</span><h2>{isStaff ? <>A connected campus.<br />Every resource accounted for.</> : <>A little planning.<br />A world of possibility.</>}</h2><p>{isStaff ? user.role === 'admin' ? 'Manage users, departments, laboratories, and system-wide activity.' : user.role === 'coordinator' ? 'Review department requests, set priorities, and define booking rules.' : 'Manage lab availability, equipment handovers, and returns.' : 'Find the space and tools for your next great idea.'}</p><Link to={isStaff ? '/manage-resources' : '/resources'} className="primary-button">{isStaff ? 'Manage resources ↗' : 'Explore resources ↗'}</Link></div><div className="welcome-art" aria-hidden="true"><span>DISCOVER</span><b>↗</b><span>RESERVE · CREATE</span></div></section>
    <section className="stat-grid">
      <StatCard label="Total bookings" value={totals.total} icon="◫" />
      <StatCard label="Pending approval" value={totals.pending} icon="◷" />
      <StatCard label="Approved bookings" value={totals.approved} icon="✓" />
      <StatCard label={isStaff ? 'Currently issued' : 'Cancelled'} value={isStaff ? totals.currentlyIssued : totals.cancelled} icon={isStaff ? '⇄' : '×'} />
    </section>
    <section className="dashboard-grid">
      <div className="panel"><div className="panel-head"><div><span className="eyebrow">Bookings</span><h3>Upcoming activity</h3></div><Link to="/bookings">View all</Link></div>
        {upcoming.length ? <div className="booking-list">{upcoming.map((b) => <div className="booking-row" key={b._id}><div className="date-tile"><strong>{new Date(b.bookingDate).getDate()}</strong><span>{new Date(b.bookingDate).toLocaleString('en', { month: 'short' })}</span></div><div className="grow"><strong>{b.lab?.name || b.equipmentItems?.[0]?.equipment?.name || 'Resource booking'}</strong><span>{dateLabel(b.bookingDate)} · {b.startTime}–{b.endTime}</span></div><StatusPill value={b.status} /></div>)}</div> : <div className="inline-empty">No upcoming bookings.</div>}
      </div>
      {canAnalyze ? <div className="panel"><div className="panel-head"><div><span className="eyebrow">Insights</span><h3>Most used resources</h3></div></div>
        <div className="rank-list">{(analytics.data?.mostBookedLabs || []).map((item, i) => <div key={item.name}><span>{i + 1}</span><div><strong>{item.name}</strong><small>{item.bookings} bookings</small></div><meter min="0" max={Math.max(...analytics.data.mostBookedLabs.map((x) => x.bookings), 1)} value={item.bookings} /></div>)}</div>
        {!analytics.data?.mostBookedLabs?.length && <div className="inline-empty">Usage insights appear after bookings are created.</div>}
      </div> : <div className="panel"><span className="eyebrow">{canBook ? 'My reservations' : 'Lab operations'}</span><h3>{canBook ? 'Every step in one place' : 'From issue to return'}</h3><p className="muted-copy">{canBook ? 'Track your requests, approval status, cancellations, and booking history.' : 'Issue approved equipment, confirm returns, and record damage or missing items.'}</p><Link className="secondary-button" to={canBook ? '/bookings' : '/operations'}>{canBook ? 'View my bookings' : 'Open issue & return'} ↗</Link></div>}
    </section>
  </>;
}
