import { useMemo, useState } from 'react';
import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../context/AuthContext';

const emptyLab = { code: '', name: '', department: '', capacity: 20, location: '', facilities: '', status: 'available', maintenanceNote: '', availabilityDays: '1,2,3,4,5', availabilityStart: '08:00', availabilityEnd: '18:00' };
const emptyEquipment = { code: '', name: '', category: '', department: '', lab: '', totalQuantity: 1, condition: 'good', maintenanceStatus: 'operational', maintenanceNote: '', approvalRequired: false };
const emptyNamed = { name: '', code: '' };

function departmentId(item) {
  return item?.department?._id || item?.department || '';
}

export function ManageResourcesPage() {
  const { user, can } = useAuth();
  const isAdmin = user.role === 'admin';
  const isLabStaff = user.role === 'labStaff';
  const actorDepartment = user.department?._id || user.department || '';
  const canDeleteResources = tab => tab === 'labs' ? can('labs.manage') : tab === 'equipment' ? can('equipment.manage') : isAdmin;

  const labs = useAsync(() => api.get('/resources/labs'), []);
  const equipment = useAsync(() => isLabStaff ? api.get('/resources/equipment') : Promise.resolve([]), [isLabStaff]);
  const departments = useAsync(() => api.get('/resources/departments'), []);
  const categories = useAsync(() => (isAdmin || isLabStaff) ? api.get('/resources/categories') : Promise.resolve([]), [isAdmin, isLabStaff]);
  const [tab, setTab] = useState('labs');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const scopedLabs = useMemo(() => (labs.data || []).filter((item) => isAdmin || departmentId(item) === actorDepartment), [labs.data, isAdmin, actorDepartment]);
  const scopedEquipment = useMemo(() => (equipment.data || []).filter((item) => isAdmin || departmentId(item) === actorDepartment), [equipment.data, isAdmin, actorDepartment]);

  const loading = labs.loading || equipment.loading || departments.loading || categories.loading;
  const configs = useMemo(() => ({
    labs: { title: 'Laboratory', empty: emptyLab, data: scopedLabs, reload: labs.reload },
    equipment: { title: 'Equipment', empty: emptyEquipment, data: scopedEquipment, reload: equipment.reload },
    departments: { title: 'Department', empty: emptyNamed, data: departments.data, reload: departments.reload },
    categories: { title: 'Equipment category', empty: emptyNamed, data: categories.data, reload: categories.reload },
  }), [scopedLabs, scopedEquipment, departments.data, categories.data]);

  if (loading) return <Loader />;

  const tabs = ['labs', ...(isLabStaff ? ['equipment'] : []), ...(isAdmin ? ['departments', 'categories'] : [])];
  const data = configs[tab].data || [];
  const canCreateCurrent = tab === 'labs' ? can('labs.manage') : tab === 'equipment' ? can('equipment.manage') : isAdmin;
  const labIdentityReadOnly = isLabStaff && tab === 'labs';

  function openCreate() {
    if (!canCreateCurrent) return;
    setError('');
    const base = { ...configs[tab].empty };
    if (!isAdmin && ['labs', 'equipment'].includes(tab)) base.department = actorDepartment;
    setForm(base);
    setModal({ mode: 'create' });
  }

  function openEdit(item) {
    setError('');
    const mapped = tab === 'labs'
      ? { ...item, department: departmentId(item), facilities: (item.facilities || []).join(', '), availabilityDays: [...new Set((item.availableSlots || []).map((x) => x.dayOfWeek))].join(','), availabilityStart: item.availableSlots?.[0]?.startTime || '08:00', availabilityEnd: item.availableSlots?.[0]?.endTime || '18:00' }
      : tab === 'equipment'
        ? { ...item, department: departmentId(item), lab: item.lab?._id || item.lab || '' }
        : { ...item };
    setForm(mapped);
    setModal({ mode: 'edit', id: item._id });
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const endpoint = `/resources/${tab}`;
    let payload = { ...form };
    ['_id', '__v', 'createdAt', 'updatedAt', 'availableForSlot', 'availableQuantity', 'availabilityReason'].forEach((key) => delete payload[key]);

    if (!isAdmin && ['labs', 'equipment'].includes(tab)) payload.department = actorDepartment;

    if (tab === 'labs') {
      const days = String(payload.availabilityDays || '').split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
      payload = { ...payload, capacity: Number(payload.capacity), facilities: String(payload.facilities || '').split(',').map((x) => x.trim()).filter(Boolean), availableSlots: days.map((dayOfWeek) => ({ dayOfWeek, startTime: payload.availabilityStart, endTime: payload.availabilityEnd })) };
      delete payload.availabilityDays; delete payload.availabilityStart; delete payload.availabilityEnd;
      if (labIdentityReadOnly) {
        payload = {
          availableSlots: payload.availableSlots,
          status: payload.status,
          maintenanceNote: payload.maintenanceNote,
        };
      }
    }
    if (tab === 'equipment') payload = { ...payload, totalQuantity: Number(payload.totalQuantity), lab: payload.lab || null };

    try {
      if (modal.mode === 'create') await api.post(endpoint, payload);
      else await api.put(`${endpoint}/${modal.id}`, payload);
      setModal(null);
      setMessage(`${configs[tab].title} saved.`);
      await configs[tab].reload();
    } catch (err) {
      setError(err.message || `Unable to save ${configs[tab].title.toLowerCase()}.`);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setError('');
    try {
      await api.delete(`/resources/${tab}/${item._id}`);
      setMessage(`${configs[tab].title} deleted.`);
      await configs[tab].reload();
    } catch (err) {
      setError(err.message || `Unable to delete ${configs[tab].title.toLowerCase()}.`);
    }
  }

  const availableLabsForEquipment = isAdmin ? (labs.data || []) : scopedLabs;

  return <>
    <PageHeader eyebrow="Resource control" title="Manage resources" subtitle={isAdmin ? 'Manage university laboratories, departments, and equipment categories.' : isLabStaff ? 'Manage department lab availability, equipment inventory, blocking, and maintenance.' : 'Manage the laboratories assigned to your department.'} actions={canCreateCurrent ? <button className="primary-button" onClick={openCreate}>+ Add {configs[tab].title.toLowerCase()}</button> : null} />
    {!isAdmin && !actorDepartment && <div className="alert error">Your account has no department assignment. Ask an administrator to assign one before managing resources.</div>}
    {message && <div className="alert success">{message}</div>}
    {(error || labs.error || equipment.error || departments.error || categories.error) && <div className="alert error">{error || labs.error || equipment.error || departments.error || categories.error}</div>}
    <div className="toolbar"><div className="segmented">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setError(''); }}>{item}</button>)}</div></div>
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Code / Category</th>{tab === 'labs' && <><th>Department</th><th>Capacity</th><th>Status</th></>}{tab === 'equipment' && <><th>Department</th><th>Quantity</th><th>Status</th></>}<th></th></tr></thead><tbody>{data.map((item) => <tr key={item._id}><td><strong>{item.name}</strong>{item.location && <span>{item.location}</span>}</td><td>{item.code || item.category}</td>{tab === 'labs' && <><td>{item.department?.name}</td><td>{item.capacity}</td><td><StatusPill value={item.status} /></td></>}{tab === 'equipment' && <><td>{item.department?.name}</td><td>{item.totalQuantity}</td><td><StatusPill value={item.maintenanceStatus} /></td></>}<td className="row-actions"><button className="secondary-button small" onClick={() => openEdit(item)}>Edit</button>{((['labs','equipment'].includes(tab) && canDeleteResources(tab)) || (['departments','categories'].includes(tab) && isAdmin)) && <button className="text-button danger" onClick={() => remove(item)}>Delete</button>}</td></tr>)}</tbody></table></div>

    <Modal open={Boolean(modal)} title={`${modal?.mode === 'create' ? 'Add' : 'Edit'} ${configs[tab].title.toLowerCase()}`} onClose={() => { setModal(null); setError(''); }}>
      <form className="modal-body" onSubmit={save}>
        <label>Name<input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={labIdentityReadOnly} /></label>
        <label>Code<input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={labIdentityReadOnly} /></label>
        {tab === 'labs' && <>
          <label>Department<select value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} required disabled={!isAdmin}>{isAdmin && <option value="">Select</option>}{departments.data.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>
          <label>Capacity<input type="number" min="1" value={form.capacity || 1} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required disabled={labIdentityReadOnly} /></label>
          <label>Location<input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} required disabled={labIdentityReadOnly} /></label>
          <label>Facilities (comma separated)<input value={form.facilities || ''} onChange={(e) => setForm({ ...form, facilities: e.target.value })} disabled={labIdentityReadOnly} /></label>
          <label>Available weekdays <span className="field-help">0=Sun, 1=Mon … 6=Sat</span><input value={form.availabilityDays || ''} onChange={(e) => setForm({ ...form, availabilityDays: e.target.value })} placeholder="1,2,3,4,5" /></label>
          <div className="time-pair"><label>Available from<input type="time" value={form.availabilityStart || '08:00'} onChange={(e) => setForm({ ...form, availabilityStart: e.target.value })} /></label><label>Available until<input type="time" value={form.availabilityEnd || '18:00'} onChange={(e) => setForm({ ...form, availabilityEnd: e.target.value })} /></label></div>
          <label>Status<select value={form.status || 'available'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="available">Available</option><option value="reserved">Reserved</option><option value="inUse">In Use</option><option value="maintenance">Maintenance</option><option value="closed">Closed</option></select></label>
          <label>Maintenance note<textarea rows="2" value={form.maintenanceNote || ''} onChange={(e) => setForm({ ...form, maintenanceNote: e.target.value })} /></label>
          {isLabStaff && <p className="field-help">Lab Staff can update availability, operational status, and maintenance notes. Lab identity/capacity is managed by the Coordinator or Administrator.</p>}
        </>}
        {tab === 'equipment' && <>
          <label>Category<select value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} required><option value="">Select</option>{categories.data.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}</select></label>
          <label>Department<select value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} required disabled={!isAdmin}>{isAdmin && <option value="">Select</option>}{departments.data.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>
          <label>Home lab<select value={form.lab || ''} onChange={(e) => setForm({ ...form, lab: e.target.value })}><option value="">Shared / no fixed lab</option>{availableLabsForEquipment.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}</select></label>
          <label>Total quantity<input type="number" min="1" value={form.totalQuantity || 1} onChange={(e) => setForm({ ...form, totalQuantity: e.target.value })} required /></label>
          <label>Condition<select value={form.condition || 'good'} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="faulty">Faulty</option></select></label>
          <label>Maintenance status<select value={form.maintenanceStatus || 'operational'} onChange={(e) => setForm({ ...form, maintenanceStatus: e.target.value })}><option value="operational">Operational</option><option value="scheduled">Scheduled</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select></label>
          <label>Maintenance note<textarea rows="2" value={form.maintenanceNote || ''} onChange={(e) => setForm({ ...form, maintenanceNote: e.target.value })} /></label>
          <label className="checkbox-field"><input type="checkbox" checked={Boolean(form.approvalRequired)} onChange={(e) => setForm({ ...form, approvalRequired: e.target.checked })} /> Require staff approval whenever this equipment is requested</label>
        </>}
        <div className="form-actions"><button className="primary-button">Save</button></div>
      </form>
    </Modal>
  </>;
}
