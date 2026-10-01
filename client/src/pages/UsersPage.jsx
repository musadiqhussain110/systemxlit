import policy from '../../../shared/rolePermissions.json';
import { useState } from 'react';
import { api } from '../api/http';
import { useAsync } from '../hooks/useAsync';
import { PageHeader } from '../components/PageHeader';
import { Loader } from '../components/Loader';
import { Modal } from '../components/Modal';
import { roleLabel } from '../utils/format';

const emptyForm = { name: '', email: '', password: '', role: 'student', department: '', registrationNumber: '' };

export function UsersPage() {
  const users = useAsync(() => api.get('/users'), []);
  const departments = useAsync(() => api.get('/resources/departments'), []);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (users.loading || departments.loading) return <Loader />;

  function openCreate() {
    setForm(emptyForm);
    setError('');
    setModal({ mode: 'create' });
  }

  function openEdit(user) {
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'student',
      department: user.department?._id || user.department || '',
      registrationNumber: user.registrationNumber || '',
    });
    setError('');
    setModal({ mode: 'edit', id: user._id });
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      department: form.role === 'admin' ? null : (form.department || null),
      registrationNumber: form.registrationNumber || '',
    };
    if (modal.mode === 'edit' && !payload.password) delete payload.password;

    try {
      if (modal.mode === 'create') await api.post('/users', payload);
      else await api.put(`/users/${modal.id}`, payload);
      setModal(null);
      setForm(emptyForm);
      setMessage(modal.mode === 'create' ? 'User account created.' : 'User permissions updated.');
      await users.reload();
    } catch (err) {
      setError(err.message || 'Unable to save user account.');
    }
  }

  async function toggle(user) {
    setError('');
    try {
      await api.put(`/users/${user._id}`, { active: !user.active });
      await users.reload();
    } catch (err) {
      setError(err.message || 'Unable to change account status.');
    }
  }

  const needsDepartment = form.role !== 'admin';
  const needsRegistration = form.role === 'student';

  return <>
    <PageHeader eyebrow="Administration" title="Users & Permissions" subtitle="Create accounts, edit roles and department assignments, reset passwords, and enable or disable access." actions={<button className="primary-button" onClick={openCreate}>+ Add user</button>} />
    {message && <div className="alert success">{message}</div>}
    {error && !modal && <div className="alert error">{error}</div>}
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>University identity</th><th>Department</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>{users.data.map((u) => <tr key={u._id}><td><strong>{u.name}</strong></td><td>{u.email}<span>{u.registrationNumber || '—'}</span></td><td>{u.department?.name || '—'}</td><td>{roleLabel(u.role)}</td><td><span className={`status-pill ${u.active ? 'status-approved' : 'status-cancelled'}`}>{u.active ? 'Active' : 'Disabled'}</span></td><td className="row-actions"><button className="secondary-button small" onClick={() => openEdit(u)}>Edit permissions</button><button className="text-button" onClick={() => toggle(u)}>{u.active ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table></div>

    <Modal open={Boolean(modal)} title={modal?.mode === 'create' ? 'Create user' : 'Edit user & permissions'} onClose={() => { setModal(null); setError(''); }}>
      <form className="modal-body" onSubmit={save}>
        {error && <div className="alert error">{error}</div>}
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>{modal?.mode === 'create' ? 'Account password' : 'New password (leave blank to keep current password)'}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength="8" required={modal?.mode === 'create'} /></label>
        <label>Role<select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, department: e.target.value === 'admin' ? '' : form.department })}><option value="student">Student</option><option value="faculty">Faculty</option><option value="labStaff">Lab Staff</option><option value="coordinator">Department Coordinator</option><option value="admin">Administrator</option></select></label>
        <div className="role-permission-preview"><strong>Assigned duties</strong><ul>{policy.duties[form.role]?.map(duty => <li key={duty}>{duty}</li>)}</ul></div>
        {needsDepartment && <label>Department<select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required><option value="">Select department</option>{departments.data.map((d) => <option value={d._id} key={d._id}>{d.name}</option>)}</select></label>}
        <label>Registration number<input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} required={needsRegistration} placeholder={needsRegistration ? 'Required for students' : 'Optional'} /></label>
        <div className="form-actions"><button className="primary-button">{modal?.mode === 'create' ? 'Create user' : 'Save permissions'}</button></div>
      </form>
    </Modal>
  </>;
}
