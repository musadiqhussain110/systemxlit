import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { useAuth } from '../context/AuthContext';

export function NewBookingPage() {
  const navigate = useNavigate();
  const { state: selection } = useLocation();
  const { user } = useAuth();
  const labs = useAsync(() => api.get('/resources/labs'), []);
  const equipment = useAsync(() => api.get('/resources/equipment'), []);
  const departments = useAsync(() => api.get('/resources/departments'), []);
  const [form, setForm] = useState({ department: selection?.department || user.department?._id || user.department || '', lab: selection?.lab || '', bookingDate: selection?.bookingDate || '', startTime: selection?.startTime || '', endTime: selection?.endTime || '', purpose: '', capacity: 1 });
  const [items, setItems] = useState(selection?.equipment ? [{ equipment: selection.equipment, quantity: 1, name: selection.name }] : []);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [recommendations, setRecommendations] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const itemIds = useMemo(() => new Set(items.map((x) => x.equipment)), [items]);
  if (labs.loading || equipment.loading || departments.loading) return <Loader />;

  if (labs.error || equipment.error || departments.error) return <div className="alert error" role="alert">{labs.error || equipment.error || departments.error}</div>;

  function addEquipment() {
    if (!selectedEquipment || itemIds.has(selectedEquipment)) return;
    const resource = equipment.data.find((x) => x._id === selectedEquipment);
    const quantity = Number(selectedQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) return setMessage({ type: 'error', text: 'Equipment quantity must be a positive whole number.' });
    if (!resource || quantity > Number(resource.totalQuantity)) return setMessage({ type: 'error', text: 'Choose a quantity within the equipment stock.' });
    setMessage(null);
    setItems([...items, { equipment: selectedEquipment, quantity, name: resource.name }]);
    setSelectedEquipment(''); setSelectedQuantity(1);
  }

  function payload() {
    return { ...form, lab: form.lab || null, equipmentItems: items.map(({ equipment: id, quantity }) => ({ equipment: id, quantity })), bookingDate: form.bookingDate };
  }

  async function getRecommendations() {
    setMessage(null);
    if (!form.department || !form.bookingDate || !form.startTime || !form.endTime) return setMessage({ type: 'error', text: 'Choose department, date and time first.' });
    if (form.endTime <= form.startTime) return setMessage({ type: 'error', text: 'End time must be after start time.' });
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1) return setMessage({ type: 'error', text: 'Expected participants must be a positive whole number.' });
    setBusy(true);
    try {
      const data = await api.post('/bookings/recommendations', { bookingDate: form.bookingDate, startTime: form.startTime, endTime: form.endTime, departmentId: form.department, capacity: Math.max(1, Number(form.capacity) || 1), purpose: form.purpose, equipmentItems: payload().equipmentItems });
      setRecommendations(data.slice(0, 5));
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function submit(e) {
    e.preventDefault(); setMessage(null);
    const purpose = form.purpose.trim();
    if (purpose.length < 5 || purpose.length > 800) return setMessage({ type: 'error', text: 'Describe the booking purpose in 5–800 characters.' });
    if (form.endTime <= form.startTime) return setMessage({ type: 'error', text: 'End time must be after start time.' });
    if (!form.lab && !items.length) return setMessage({ type: 'error', text: 'Select a lab, equipment, or both.' });
    setBusy(true);
    try { await api.post('/bookings', payload()); navigate('/bookings', { state: { success: 'Booking request submitted successfully.' } }); }
    catch (err) {
      const suggestions = err.details?.suggestions;
      setMessage({ type: 'error', text: err.message });
      if (suggestions?.length) setRecommendations(suggestions.map((x) => ({ alternativeSlot: x })));
    } finally { setBusy(false); }
  }

  return <>
    <PageHeader eyebrow="Reservation" title="Create a booking" subtitle="Reserve a lab, equipment, or both. Availability and booking rules are checked before the request is accepted." />
    <div className="form-layout"><form className="panel form-panel" onSubmit={submit}>
      {message && <div className={`alert ${message.type}`} role="alert">{message.text}</div>}
      <div className="form-section"><h3>1. Booking details</h3><div className="form-grid two">
        <label>Department<select value={form.department} onChange={(e) => { setForm({ ...form, department: e.target.value, lab: '' }); setItems([]); setSelectedEquipment(''); setRecommendations([]); }} required><option value="">Select department</option>{departments.data.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>
        <label>Lab (optional)<select value={form.lab} onChange={(e) => setForm({ ...form, lab: e.target.value })}><option value="">No lab / equipment only</option>{labs.data.filter((l) => (l.department?._id || l.department) === form.department).map((l) => <option key={l._id} value={l._id}>{l.name} · {l.capacity} seats</option>)}</select></label>
        <label>Expected participants<input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></label>
        <label>Date<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.bookingDate} onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} required /></label>
        <div className="time-pair"><label>Start<input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required /></label><label>End<input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required /></label></div>
      </div></div>
      <div className="form-section"><h3>2. Equipment</h3><div className="equipment-picker"><select aria-label="Equipment" value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)}><option value="">Select equipment</option>{equipment.data.filter((x) => !itemIds.has(x._id) && (x.department?._id || x.department) === form.department).map((x) => <option value={x._id} key={x._id}>{x.name} · {x.availableQuantity ?? x.totalQuantity} available</option>)}</select><input type="number" min="1" aria-label="Equipment quantity" value={selectedQuantity} onChange={(e) => setSelectedQuantity(e.target.value)} /><button type="button" className="secondary-button" onClick={addEquipment}>Add</button></div>
        <div className="selected-items">{items.map((item) => <div key={item.equipment}><span><strong>{item.name}</strong> × {item.quantity}</span><button type="button" className="text-button danger" onClick={() => setItems(items.filter((x) => x.equipment !== item.equipment))}>Remove</button></div>)}</div>
      </div>
      <div className="form-section"><h3>3. Booking purpose</h3><label>Purpose<textarea rows="4" minLength="5" maxLength="800" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Final-year project testing with embedded systems hardware" required /></label><p className="field-help">Describe your purpose in 5–800 characters. Priority is assigned by the department coordinator during review. Faculty academic priority is applied automatically when enabled by booking rules.</p></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={getRecommendations} disabled={busy}>Smart recommendations</button><button className="primary-button" disabled={busy || (!form.lab && items.length === 0)}>{busy ? 'Checking…' : 'Submit request'}</button></div>
    </form>
    <aside className="panel recommendation-panel"><span className="eyebrow">Smart resource match</span><h3>Recommended options</h3><p>The system ranks suitable labs using availability, department match, and capacity.</p>
      {!recommendations.length && <div className="recommendation-placeholder">Choose a date and time, then run Smart recommendations.</div>}
      {recommendations.map((r, i) => r.alternativeSlot ? <button key={i} className="recommend-card" onClick={() => setForm({ ...form, startTime: r.alternativeSlot.startTime, endTime: r.alternativeSlot.endTime })}><strong>Alternative slot</strong><span>{r.alternativeSlot.startTime}–{r.alternativeSlot.endTime}</span></button> : <button key={r.lab._id} className="recommend-card" disabled={!r.available} onClick={() => setForm({ ...form, lab: r.lab._id })}><div><strong>{r.lab.name}</strong><span>{r.lab.capacity} seats · {r.lab.department?.code}</span></div><b>{r.available ? `${r.score}%` : 'Unavailable'}</b></button>)}
    </aside></div>
  </>;
}
