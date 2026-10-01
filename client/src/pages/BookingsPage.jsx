import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { dateLabel, statusLabel } from '../utils/format';

const priorityRank = { urgent: 0, research: 1, academic: 2, normal: 3 };

export function BookingsPage() {
  const location = useLocation();
  const { user, isStaff, can, canBook } = useAuth();
  const canSetPriority = can('bookings.priority');
  const canReview = can('bookings.review');
  const [conflictCheck, setConflictCheck] = useState(null);
  const bookings = useAsync(() => api.get('/bookings'), []);
  const [filter, setFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState('');
  const [flash, setFlash] = useState(location.state?.success || '');
  const [error, setError] = useState('');

  if (bookings.loading) return <Loader />;

  const data = (bookings.data || [])
    .filter((b) => {
      const bookingDay = String(b.bookingDate || '').slice(0, 10);
      const statusMatches = filter === 'all' || b.status === filter || b.approvalStatus === filter;
      const priorityMatches = priorityFilter === 'all' || b.priority === priorityFilter;
      return statusMatches && priorityMatches && (!fromDate || bookingDay >= fromDate) && (!toDate || bookingDay <= toDate);
    })
    .sort((a, b) => isStaff ? (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) : 0);

  async function decision(value) {
    setError('');
    try {
      const payload = { decision: value, reason };
      if (canSetPriority) payload.priority = review.priority;
      await api.patch(`/bookings/${review._id}/decision`, payload);
      setReview(null);
      setReason('');
      setFlash(`Booking ${value}.`);
      await bookings.reload();
    } catch (err) {
      setError(err.message || 'Unable to review this booking.');
      if (err.details?.availability) setConflictCheck({ availability: err.details.availability, suggestions: err.details.suggestions || [] });
    }
  }

  async function cancel(id) {
    if (!window.confirm('Cancel this booking?')) return;
    setError('');
    try {
      await api.patch(`/bookings/${id}/cancel`, { reason: 'Cancelled by user' });
      setFlash('Booking cancelled.');
      await bookings.reload();
    } catch (err) {
      setError(err.message || 'Unable to cancel this booking.');
    }
  }

  return <>
    <PageHeader eyebrow="Workflow" title={user.role === 'admin' ? 'Booking activity' : isStaff ? 'Booking requests' : 'My bookings'} subtitle={user.role === 'admin' ? 'Monitor university-wide booking activity and approval history.' : isStaff ? 'Review department requests and track approval status.' : 'Track approval status, reservation progress, and booking history.'} />
    {flash && <div className="alert success" onClick={() => setFlash('')}>{flash}</div>}
    {(error || bookings.error) && <div className="alert error">{error || bookings.error}</div>}
    <div className="toolbar"><div className="segmented compact">{['all', 'pending', 'reserved', 'inUse', 'completed', 'cancelled', 'rejected', 'overdue', 'returnedLate', 'damaged'].map((x) => <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>{statusLabel(x)}</button>)}</div></div>
    <div className="filter-row availability-filters">
      {isStaff && <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Priority filter"><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="research">Research</option><option value="academic">Academic</option><option value="normal">Normal</option></select>}
      <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="Bookings from date" />
      <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Bookings to date" />
      {(fromDate || toDate || priorityFilter !== 'all') && <button className="secondary-button" type="button" onClick={() => { setFromDate(''); setToDate(''); setPriorityFilter('all'); }}>Clear filters</button>}
    </div>
    {data.length ? <div className="table-wrap"><table><thead><tr><th>Date / Time</th><th>Requester</th><th>Resources</th><th>Purpose</th>{isStaff && <th>Priority</th>}<th>Approval</th><th>Status</th><th></th></tr></thead><tbody>{data.map((b) => <tr key={b._id}><td><strong>{dateLabel(b.bookingDate)}</strong><span>{b.startTime}–{b.endTime}</span></td><td><strong>{b.user?.name || 'You'}</strong><span>{b.user?.registrationNumber || b.user?.role || ''}</span></td><td><strong>{b.lab?.name || 'Equipment only'}</strong><span>{b.equipmentItems?.map((x) => `${x.equipment?.name} ×${x.quantity}`).join(', ') || 'No equipment'}</span></td><td className="purpose-cell">{b.purpose}{b.rejectionReason && <span>Reviewer: {b.rejectionReason}</span>}{b.cancellationReason && <span>Cancelled: {b.cancellationReason}</span>}</td>{isStaff && <td><StatusPill value={b.priority} /></td>}<td><StatusPill value={b.approvalStatus} /></td><td><StatusPill value={b.status} /></td><td className="row-actions">{canReview && b.approvalStatus === 'pending' && b.status === 'pendingApproval' && <button className="secondary-button small" onClick={() => { setError(''); setConflictCheck(null); setReview(b); }}>Review</button>}{canBook && (b.user?._id || b.user) === user._id && !['completed','cancelled','rejected','inUse','overdue','damaged','returnedLate'].includes(b.status) && <button className="text-button danger" onClick={() => cancel(b._id)}>Cancel</button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No bookings match this filter" />}
    <Modal open={Boolean(review)} title="Review booking request" onClose={() => { setReview(null); setError(''); }}><div className="modal-body"><p><strong>{review?.user?.name}</strong> requested {review?.lab?.name || 'equipment'} for {review && dateLabel(review.bookingDate)} from {review?.startTime} to {review?.endTime}.</p>{canSetPriority ? <label>Priority level<select value={review?.priority || 'normal'} onChange={(e) => setReview({ ...review, priority: e.target.value })}><option value="normal">Normal</option><option value="academic">Academic</option><option value="research">Research</option><option value="urgent">Urgent</option></select></label> : <p><strong>Priority:</strong> {review?.priority || 'normal'} <span className="field-help">Only the department coordinator can change priority.</span></p>}{can('bookings.conflicts') && <><button type="button" className="secondary-button" onClick={async () => { try { setConflictCheck(await api.get(`/bookings/${review._id}/conflicts`)); } catch (err) { setError(err.message); } }}>Check conflicts</button>{conflictCheck && <div className={`alert ${conflictCheck.availability.available ? 'success' : 'error'}`}>{conflictCheck.availability.available ? 'No resource conflicts for this request.' : <><strong>Resource conflict detected.</strong><p>{conflictCheck.availability.reason || 'The selected resources overlap another reservation.'}</p>{conflictCheck.suggestions?.length ? <p>Available alternatives: {conflictCheck.suggestions.map(slot => `${slot.startTime}–${slot.endTime}`).join(', ')}. Include an alternative in the reviewer note so the requester can rebook.</p> : <p>Ask the requester to select another lab or date.</p>}</>}</div>}</>}<label>Reviewer note<textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional for approval; recommended for rejection" /></label>{(error || bookings.error) && <div className="alert error">{error || bookings.error}</div>}<div className="form-actions"><button className="danger-button" onClick={() => decision('rejected')}>Reject</button><button className="primary-button" onClick={() => decision('approved')}>Approve</button></div></div></Modal>
  </>;
}
