import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/http';
import { SystemBrand } from '../components/SystemBrand';
import { useAuth } from '../context/AuthContext';

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'student',
  department: '',
  registrationNumber: '',
};

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [departments, setDepartments] = useState([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/auth/setup-status'), api.get('/auth/registration-departments')])
      .then(([status, departmentRows]) => {
        setNeedsSetup(Boolean(status.needsAdminSetup));
        setDepartments(Array.isArray(departmentRows) ? departmentRows : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        department: form.department,
        registrationNumber: form.role === 'student' ? form.registrationNumber : '',
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="login-page auth-theme">
    <div className="login-visual">
      <SystemBrand className="auth-brand-hero" subtitle="University Lab & Equipment Booking System" />
      <div className="visual-badge">Personal university accounts</div>
      <h1>Your access.<br />Your bookings.<br />Your identity.</h1>
      <p>Create an individual account so every request, approval, notification, issue, return, and activity record is securely tied to the right user.</p>
      <div className="visual-grid"><span>Individual identity</span><span>Secure password</span><span>Department access</span><span>Personal history</span></div>
    </div>
    <div className="login-panel"><form className="login-card register-card" onSubmit={submit}>
      <SystemBrand className="login-brand" subtitle="Student / Faculty registration" />
      <div><div className="eyebrow">Create account</div><h2>Student / Faculty registration</h2><p>Use your own email and password. Staff roles are created by an administrator.</p></div>
      {error && <div className="alert error">{error}</div>}
      {needsSetup && <div className="alert setup-alert">Administrator setup must be completed first. <Link to="/setup">Create the first administrator</Link>.</div>}
      <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={needsSetup || loading} /></label>
      <div className="auth-two-column">
        <label>Account type<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={needsSetup || loading}><option value="student">Student</option><option value="faculty">Faculty</option></select></label>
        <label>Department<select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required disabled={needsSetup || loading}><option value="">Select department</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>
      </div>
      {form.role === 'student' && <label>Registration number<input placeholder="e.g. 24PWChE1760" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} required disabled={needsSetup || loading} /></label>}
      <label>Email<input type="email" autoComplete="email" placeholder="your university email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={needsSetup || loading} /></label>
      <div className="auth-two-column">
        <label>Password<input type="password" autoComplete="new-password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required disabled={needsSetup || loading} /></label>
        <label>Confirm password<input type="password" autoComplete="new-password" minLength="8" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required disabled={needsSetup || loading} /></label>
      </div>
      <button className="primary-button" disabled={busy || needsSetup || loading}>{busy ? 'Creating account…' : 'Create account'}</button>
      <div className="auth-links single"><span>Already have an account?</span><Link to="/login">Sign in</Link></div>
    </form></div>
  </div>;
}
