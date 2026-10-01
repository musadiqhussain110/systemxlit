import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { Loader } from '../components/Loader';

function BarList({ items = [], valueKey, labelKey = 'name', suffix = '' }) {
  const max = Math.max(...items.map((x) => Number(x[valueKey]) || 0), 1);
  if (!items.length) return <div className="inline-empty">No data yet.</div>;
  return <div className="bar-list">{items.map((item) => <div key={`${item[labelKey]}-${item[valueKey]}`}><div><span>{item[labelKey]}</span><strong>{item[valueKey]}{suffix}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${((Number(item[valueKey]) || 0) / max) * 100}%` }} /></div></div>)}</div>;
}

export function AnalyticsPage() {
  const analytics = useAsync(() => api.get('/analytics/summary'), []);
  if (analytics.loading) return <Loader />;
  const d = analytics.data || { totals: {} };
  return <>
    <PageHeader eyebrow="Usage intelligence" title="Analytics" subtitle="Monitor booking demand, utilization, issued equipment, damage reports, department usage, peak hours, and underused resources." />
    {analytics.error && <div className="alert error" role="alert">{analytics.error}</div>}
    <section className="stat-grid">
      <StatCard label="Bookings" value={d.totals.total || 0} icon="◫" />
      <StatCard label="Pending" value={d.totals.pending || 0} icon="◷" />
      <StatCard label="Currently issued" value={d.totals.currentlyIssued || 0} icon="⇄" />
      <StatCard label="Overdue" value={d.totals.overdue || 0} icon="!" />
      <StatCard label="Avg. lab utilization" value={`${d.totals.averageLabUtilization || 0}%`} icon="↗" />
      <StatCard label="Damage / missing reports" value={d.totals.damageReports || 0} icon="⚠" />
    </section>
    <div className="analytics-grid">
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Demand</span><h3>Most-booked labs</h3></div></div><BarList items={d.mostBookedLabs} valueKey="bookings" /></section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Equipment</span><h3>Most-used equipment</h3></div></div><BarList items={d.mostUsedEquipment} valueKey="quantity" /></section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Departments</span><h3>Usage by department</h3></div></div><BarList items={d.usageByDepartment} valueKey="bookings" /></section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Trend</span><h3>Monthly bookings</h3></div></div><BarList items={d.monthlyUsage} valueKey="bookings" labelKey="label" /></section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Demand timing</span><h3>Peak booking hours</h3></div></div><BarList items={d.peakBookingHours} valueKey="bookings" labelKey="label" /></section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Optimization</span><h3>Underused labs</h3></div></div><BarList items={d.underusedLabs} valueKey="bookings" /></section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Approvals</span><h3>Booking rejection reasons</h3></div></div><BarList items={d.rejectionReasons} valueKey="count" labelKey="reason" /></section>
    </div>
  </>;
}
