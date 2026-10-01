import { useState } from 'react';
import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';
import { Modal } from '../components/Modal';
import { dateLabel, dateTimeLabel } from '../utils/format';

export function OperationsPage() {
  const bookings = useAsync(() => api.get('/bookings'), []);
  const issues = useAsync(() => api.get('/issues'), []);
  const [returning, setReturning] = useState(null);
  const [conditions, setConditions] = useState({});
  const [damageNotes, setDamageNotes] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (bookings.loading || issues.loading) return <Loader />;
  const ready = (bookings.data || []).filter((b) => ['reserved', 'approved'].includes(b.status));
  const active = (issues.data || []).filter((x) => !x.returnedAt);

  async function issue(booking) {
    setError(''); setBusy(true);
    try { await api.post(`/issues/${booking._id}/issue`, {}); setMessage('Resources issued successfully.'); await Promise.all([bookings.reload(), issues.reload()]); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function completeReturn(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
    const items = returning.items.map((x) => ({ equipment: x.equipment._id, returnCondition: conditions[x.equipment._id] || 'good', damageNote: damageNotes[x.equipment._id] || '' }));
    await api.patch(`/issues/${returning.booking._id}/return`, { items }); setReturning(null); setConditions({}); setDamageNotes({}); setMessage('Return recorded successfully.'); await Promise.all([bookings.reload(), issues.reload()]);
    } catch (err) { setError(err.message || 'Unable to record the return.'); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader eyebrow="Lab operations" title="Issue & Return" subtitle="Issue approved resources, confirm returns, record condition, and identify overdue equipment." />
    {message && <div className="alert success">{message}</div>}
    {(error || bookings.error || issues.error) && <div className="alert error" role="alert">{error || bookings.error || issues.error}</div>}
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Ready</span><h3>Approved for issue</h3></div></div>{ready.length ? <div className="operation-list">{ready.map((b) => <div key={b._id} className="operation-card"><div><strong>{b.user?.name}</strong><span>{b.lab?.name || 'Equipment only'} · {dateLabel(b.bookingDate)} {b.startTime}</span><small>{b.equipmentItems?.map((x) => `${x.equipment?.name} ×${x.quantity}`).join(', ')}</small></div><button className="primary-button small" disabled={busy} onClick={() => issue(b)}>Issue now</button></div>)}</div> : <EmptyState title="Nothing waiting for issue" />}</section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">In use</span><h3>Open issue records</h3></div></div>{active.length ? <div className="operation-list">{active.map((r) => <div key={r._id} className="operation-card"><div><strong>{r.booking?.user?.name}</strong><span>Due {dateTimeLabel(r.dueAt)}</span><small>{r.items?.map((x) => `${x.equipment?.name} ×${x.quantity}`).join(', ')}</small></div><div><StatusPill value={new Date(r.dueAt) < new Date() ? 'overdue' : 'inUse'} /><button className="secondary-button small" onClick={() => setReturning(r)}>Return</button></div></div>)}</div> : <EmptyState title="No resources currently issued" />}</section>
    </div>
    <Modal open={Boolean(returning)} title="Confirm equipment return" onClose={() => { setReturning(null); setConditions({}); setDamageNotes({}); }}><form className="modal-body" onSubmit={completeReturn}>{error && <div className="alert error" role="alert">{error}</div>}<p>Record the returned condition for each issued item. Add a damage/missing note whenever a problem is reported.</p>{returning?.items.map((item) => { const condition = conditions[item.equipment._id] || 'good'; return <div className="return-item" key={item.equipment._id}><label>{item.equipment.name}<select value={condition} onChange={(e) => setConditions({ ...conditions, [item.equipment._id]: e.target.value })}><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="missing">Missing</option></select></label>{['damaged', 'missing'].includes(condition) && <label>Damage / missing report<textarea rows="2" value={damageNotes[item.equipment._id] || ''} onChange={(e) => setDamageNotes({ ...damageNotes, [item.equipment._id]: e.target.value })} placeholder="Describe the damage, missing parts, or other issue" required /></label>}</div>; })}<div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Confirm return'}</button></div></form></Modal>
  </>;
}
