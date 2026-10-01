import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/http';
import { SystemBrand } from '../components/SystemBrand';
import { useAuth } from '../context/AuthContext';

export function SetupAdminPage() {
  const { user, setupAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [needsSetup, setNeedsSetup] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/setup-status')
      .then((data) => setNeedsSetup(Boolean(data.needsAdminSetup)))
      .catch((err) => setError(err.message));
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
      await setupAdmin({ name: form.name, email: form.email, password: form.password });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (needsSetup === false) return <div className="login-page auth-theme"><div className="login-visual"><SystemBrand className="auth-brand-hero" subtitle="University Lab & Equipment Booking System" /><div className="visual-badge">Setup complete</div><h1>University account<br />system is ready.</h1><p>The initial administrator already exists. Further administrators, coordinators, and lab staff must be created from Users & Permissions.</p></div><div className="login-panel"><div className="login-card"><SystemBrand className="login-brand" subtitle="Administrator already configured" /><div><h2>Administrator already configured</h2><p>Use your assigned credentials to sign in.</p></div><Link className="primary-button auth-button-link" to="/login">Go to sign in</Link></div></div></div>;

  return <div className="login-page auth-theme">
    <div className="login-visual">
      <SystemBrand className="auth-brand-hero" subtitle="University Lab & Equipment Booking System" />
      <div className="visual-badge">One-time setup</div>
      <h1>Create the first<br />administrator.</h1>
      <p>This account controls users, permissions, departments, resources, booking rules, analytics, and system activity. Use credentials you will keep.</p>
      <div className="visual-grid"><span>No demo account</span><span>Your own email</span><span>Your own password</span><span>Full administrator access</span></div>
    </div>
    <div className="login-panel"><form className="login-card" onSubmit={submit}>
      <SystemBrand className="login-brand" subtitle="Initial configuration" />
      <div><div className="eyebrow">Initial configuration</div><h2>Administrator credentials</h2><p>This page works only while the user database is empty.</p></div>
      {error && <div className="alert error">{error}</div>}
      <label>Administrator name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label>Email<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
      <label>Password<input type="password" autoComplete="new-password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
      <label>Confirm password<input type="password" autoComplete="new-password" minLength="8" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required /></label>
      <button className="primary-button" disabled={busy || needsSetup === null}>{busy ? 'Creating administrator…' : 'Create administrator'}</button>
      <div className="auth-links single"><span>Already configured?</span><Link to="/login">Sign in</Link></div>
    </form></div>
  </div>;
}
