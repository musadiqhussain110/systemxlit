import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function scheduleLabel(slots = []) {
  if (!slots.length) return 'Open schedule';
  const sameTime = slots.every((slot) => slot.startTime === slots[0].startTime && slot.endTime === slots[0].endTime);
  if (sameTime) return `${slots.map((slot) => dayNames[Number(slot.dayOfWeek)]).join(', ')} · ${slots[0].startTime}–${slots[0].endTime}`;
  return slots.map((slot) => `${dayNames[Number(slot.dayOfWeek)]} ${slot.startTime}–${slot.endTime}`).join(' · ');
}

export function ResourcesPage() {
  const { canBook } = useAuth();
  const [tab, setTab] = useState('labs');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [availability, setAvailability] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState('');

  const slotReady = Boolean(bookingDate && startTime && endTime);
  const slotQuery = slotReady
    ? `?${new URLSearchParams({ bookingDate, startTime, endTime }).toString()}`
    : '';

  const labs = useAsync(() => api.get(`/resources/labs${slotQuery}`), [slotQuery]);
  const equipment = useAsync(() => api.get(`/resources/equipment${slotQuery}`), [slotQuery]);
  const departments = useAsync(() => api.get('/resources/departments'), []);
  const categories = useAsync(() => api.get('/resources/categories'), []);

  const labRows = Array.isArray(labs.data) ? labs.data : [];
  const equipmentRows = Array.isArray(equipment.data) ? equipment.data : [];
  const departmentRows = Array.isArray(departments.data) ? departments.data : [];
  const categoryRows = Array.isArray(categories.data) ? categories.data : [];
  const source = tab === 'labs' ? labRows : equipmentRows;

  const filtered = useMemo(() => source.filter((item) => {
    const searchable = `${item.name || ''} ${item.code || ''} ${item.category || ''} ${item.location || ''}`.toLowerCase();
    const depId = item.department?._id || item.department;
    const itemStatus = tab === 'labs' ? item.status : item.maintenanceStatus;
    const availabilityMatches = !availability
      || (availability === 'available' && item.availableForSlot)
      || (availability === 'unavailable' && !item.availableForSlot);

    return searchable.includes(search.toLowerCase())
      && (!department || depId === department)
      && (!category || item.category === category)
      && (!status || itemStatus === status)
      && availabilityMatches;
  }), [source, search, department, category, status, availability, tab]);

  const loading = labs.loading || equipment.loading || departments.loading || categories.loading;
  const loadError = labs.error || equipment.error || departments.error || categories.error;

  if (loading) return <Loader />;

  function changeTab(next) {
    setTab(next);
    setStatus('');
    setCategory('');
  }

  async function watch(resourceType, resourceId) {
    try {
      await api.post('/resources/watch', { resourceType, resourceId });
      setMessage('You will be notified when this resource becomes available.');
    } catch (error) {
      setMessage(error.message || 'Unable to create availability notification.');
    }
  }

  return <>
    <PageHeader eyebrow="Discover" title="Labs & Equipment" subtitle="Search resources and check availability for a specific date and time before creating a booking." />
    {loadError && <div className="alert error">Unable to load all resources: {loadError}</div>}
    {message && <div className="alert success">{message}</div>}

    <div className="toolbar resource-toolbar">
      <div className="segmented">
        <button className={tab === 'labs' ? 'active' : ''} onClick={() => changeTab('labs')}>Laboratories</button>
        <button className={tab === 'equipment' ? 'active' : ''} onClick={() => changeTab('equipment')}>Equipment</button>
      </div>
      <input className="search-input" aria-label="Search resources" placeholder="Search name, code, category or location…" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>

    <div className="filter-row">
      <select value={department} onChange={(e) => setDepartment(e.target.value)}>
        <option value="">All departments</option>
        {departmentRows.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
      </select>

      {tab === 'equipment' && <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All categories</option>
        {categoryRows.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
      </select>}

      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {(tab === 'labs' ? ['available', 'reserved', 'inUse', 'maintenance', 'closed'] : ['operational', 'scheduled', 'maintenance', 'retired']).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
        <option value="">Any availability</option>
        <option value="available">Available</option>
        <option value="unavailable">Unavailable</option>
      </select>
    </div>

    <div className="filter-row availability-filters">
      <input type="date" min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} aria-label="Availability date" />
      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Availability start time" />
      <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="Availability end time" />
      {(bookingDate || startTime || endTime) && <button className="secondary-button" type="button" onClick={() => { setBookingDate(''); setStartTime(''); setEndTime(''); }}>Clear slot</button>}
    </div>
    {(bookingDate || startTime || endTime) && !slotReady && <div className="alert error">Choose date, start time, and end time together to check slot availability.</div>}

    {filtered.length ? <div className="resource-grid">
      {filtered.map((item) => tab === 'labs'
        ? <article className="resource-card" key={item._id}>
          <div className="resource-top"><div className="resource-icon">L</div><StatusPill value={item.status} /></div>
          <h3>{item.name}</h3>
          <div className="resource-code">{item.code}</div>
          <dl>
            <div><dt>Department</dt><dd>{item.department?.name || 'Not assigned'}</dd></div>
            <div><dt>Capacity</dt><dd>{item.capacity} people</dd></div>
            <div><dt>Location</dt><dd>{item.location || 'Not specified'}</dd></div>
            <div><dt>Available slots</dt><dd>{scheduleLabel(item.availableSlots)}</dd></div>
            <div><dt>{slotReady ? 'Selected slot' : 'Availability'}</dt><dd>{item.availableForSlot ? 'Available' : 'Unavailable'}</dd></div>
          </dl>
          {slotReady && !item.availableForSlot && item.availabilityReason && <p className="availability-note">{item.availabilityReason}</p>}
          <div className="chips">{item.facilities?.map((x) => <span key={x}>{x}</span>)}</div>
          {!item.availableForSlot && ['maintenance', 'closed'].includes(item.status) && <button className="secondary-button watch-button" onClick={() => watch('lab', item._id)}>Notify me when available</button>}
          {canBook && <Link className="resource-book" to="/book" state={{ department: item.department?._id || item.department, ...(tab === 'labs' ? { lab: item._id } : { equipment: item._id, name: item.name }), bookingDate, startTime, endTime }}>Book this resource <span>↗</span></Link>}
        </article>
        : <article className="resource-card" key={item._id}>
          <div className="resource-top"><div className="resource-icon">E</div><StatusPill value={item.maintenanceStatus} /></div>
          <h3>{item.name}</h3>
          <div className="resource-code">{item.code}</div>
          <dl>
            <div><dt>Category</dt><dd>{item.category || 'Uncategorized'}</dd></div>
            <div><dt>Total units</dt><dd>{item.totalQuantity}</dd></div>
            <div><dt>{slotReady ? 'Available for slot' : 'Available now'}</dt><dd>{item.availableQuantity ?? item.totalQuantity}</dd></div>
            <div><dt>Home lab</dt><dd>{item.lab?.name || 'Shared resource'}</dd></div>
            <div><dt>Condition</dt><dd>{item.condition || 'Not specified'}</dd></div>
            <div><dt>Approval</dt><dd>{item.approvalRequired ? 'Required' : 'Standard rules'}</dd></div>
          </dl>
          {slotReady && !item.availableForSlot && item.availabilityReason && <p className="availability-note">{item.availabilityReason}</p>}
          {!item.availableForSlot && ['maintenance', 'retired'].includes(item.maintenanceStatus) && <button className="secondary-button watch-button" onClick={() => watch('equipment', item._id)}>Notify me when available</button>}
          {canBook && <Link className="resource-book" to="/book" state={{ department: item.department?._id || item.department, ...(tab === 'labs' ? { lab: item._id } : { equipment: item._id, name: item.name }), bookingDate, startTime, endTime }}>Book this resource <span>↗</span></Link>}
        </article>)}
    </div> : <EmptyState title="No matching resources" text={loadError ? 'Some resource data could not be loaded. Check the server and try again.' : 'Try a different filter, search term, or availability slot.'} />}
  </>;
}
