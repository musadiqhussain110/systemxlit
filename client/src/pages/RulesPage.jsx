import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { useAuth } from '../context/AuthContext';

const defaults = { department: '', maxDurationMinutes: 240, maxEquipmentQuantityPerItem: 20, advanceBookingDays: 30, minimumLeadHours: 1, approvalRequired: true, facultyPriority: true, departmentOnlyAccess: false, lateReturnRestrictionThreshold: 3, lateReturnRestrictionDays: 7 };

export function RulesPage() {
  const { user } = useAuth();
  const actorDepartment = user.department?._id || user.department || '';
  const rules = useAsync(() => api.get('/resources/rules'), []);
  const departments = useAsync(() => api.get('/resources/departments'), []);
  const [form, setForm] = useState(defaults);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const actorDepartmentName = useMemo(() => departments.data?.find((d) => d._id === actorDepartment)?.name || user.department?.name || 'your department', [departments.data, actorDepartment, user.department]);

  useEffect(() => {
    if (!rules.data) return;
    const found = rules.data.find((rule) => (rule.department?._id || rule.department) === actorDepartment) || rules.data.find(rule => !rule.department);
    setForm(found ? { ...found, department: actorDepartment } : { ...defaults, department: actorDepartment });
  }, [rules.data, actorDepartment]);

  if (rules.loading || departments.loading) return <Loader />;

  async function save(e) {
    e.preventDefault();
    setError('');
    const targetDepartment = actorDepartment;
    const payload = {
      ...form,
      department: targetDepartment,
      maxDurationMinutes: Number(form.maxDurationMinutes),
      maxEquipmentQuantityPerItem: Number(form.maxEquipmentQuantityPerItem),
      advanceBookingDays: Number(form.advanceBookingDays),
      minimumLeadHours: Number(form.minimumLeadHours),
      lateReturnRestrictionThreshold: Number(form.lateReturnRestrictionThreshold),
      lateReturnRestrictionDays: Number(form.lateReturnRestrictionDays),
    };
    ['_id', '__v', 'createdAt', 'updatedAt'].forEach((key) => delete payload[key]);
    try {
      await api.put('/resources/rules', payload);
      setMessage('Booking rules saved.');
      await rules.reload();
    } catch (err) {
      setError(err.message || 'Unable to save booking rules.');
    }
  }

  if (!actorDepartment) return <><PageHeader eyebrow="Policy" title="Booking rules" subtitle="Define department booking policy." /><div className="alert error">Your coordinator account must be assigned to a department before you can manage booking rules.</div></>;

  return <>
    <PageHeader eyebrow="Policy" title="Booking rules" subtitle={`Define booking rules for ${actorDepartmentName}.`} />
    {message && <div className="alert success">{message}</div>}
    {error && <div className="alert error">{error}</div>}
    <div className="form-layout"><form className="panel form-panel" onSubmit={save}>
      <label>Ruleset<input value={actorDepartmentName} disabled /></label>
      <div className="form-grid two rule-grid"><label>Max booking duration (minutes)<input type="number" min="30" value={form.maxDurationMinutes} onChange={(e) => setForm({ ...form, maxDurationMinutes: e.target.value })} /></label><label>Max quantity per equipment item<input type="number" min="1" value={form.maxEquipmentQuantityPerItem} onChange={(e) => setForm({ ...form, maxEquipmentQuantityPerItem: e.target.value })} /></label><label>Advance booking limit (days)<input type="number" min="0" value={form.advanceBookingDays} onChange={(e) => setForm({ ...form, advanceBookingDays: e.target.value })} /></label><label>Minimum lead time (hours)<input type="number" min="0" value={form.minimumLeadHours} onChange={(e) => setForm({ ...form, minimumLeadHours: e.target.value })} /></label><label>Late return threshold<input type="number" min="1" value={form.lateReturnRestrictionThreshold} onChange={(e) => setForm({ ...form, lateReturnRestrictionThreshold: e.target.value })} /></label><label>Restriction duration (days)<input type="number" min="1" value={form.lateReturnRestrictionDays} onChange={(e) => setForm({ ...form, lateReturnRestrictionDays: e.target.value })} /></label></div>
      <div className="toggle-row"><label><input type="checkbox" checked={Boolean(form.approvalRequired)} onChange={(e) => setForm({ ...form, approvalRequired: e.target.checked })} /> Approval required</label><label><input type="checkbox" checked={Boolean(form.facultyPriority)} onChange={(e) => setForm({ ...form, facultyPriority: e.target.checked })} /> Faculty priority</label><label><input type="checkbox" checked={Boolean(form.departmentOnlyAccess)} onChange={(e) => setForm({ ...form, departmentOnlyAccess: e.target.checked })} /> Restrict Student/Faculty bookings to this department</label></div>
      <div className="form-actions"><button className="primary-button">Save rules</button></div>
    </form><aside className="panel"><span className="eyebrow">Role boundary</span><h3>Department policy only</h3><p className="muted-copy">Define the booking rules for your assigned department. These rules determine duration, quantities, approvals, academic priority, and late-return restrictions.</p></aside></div>
  </>;
}
