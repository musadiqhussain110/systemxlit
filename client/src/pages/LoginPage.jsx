import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/http';
import { SystemBrand } from '../components/SystemBrand';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    api.get('/auth/setup-status')
      .then((data) => setNeedsSetup(Boolean(data.needsAdminSetup)))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email, form.password);
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
      <div className="visual-badge">A connected campus starts here</div>
      <h1>Book smarter.<br />Approve faster.<br />Track better.</h1>
      <p>Your next experiment starts here. Find the right space, reserve your equipment, and keep every step of your research in sync.</p>
      <div className="visual-grid"><span>Conflict-safe booking</span><span>Role-based approvals</span><span>Smart alternatives</span><span>Usage analytics</span></div>
    </div>
    <div className="login-panel"><form className="login-card" onSubmit={submit}>
      <SystemBrand className="login-brand" subtitle="Secure sign in" />
      <div><div className="eyebrow">Welcome back</div><h2>Sign in to continue</h2><p>Welcome to your campus workspace. Sign in with your university account.</p></div>
      {error && <div className="alert error">{error}</div>}
      {needsSetup && <div className="alert setup-alert">No administrator exists yet. Complete the one-time university setup before creating user accounts.</div>}
      <label>Email<input type="email" autoComplete="email" placeholder="name@university.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
      <label>Password<input type="password" autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
      <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <Link className="text-button" to="/">← Back to home</Link>
      <div className="auth-links">
        <span>Student or faculty?</span><Link to="/register">Create your account</Link>
        {needsSetup && <><span>First time setup?</span><Link to="/setup">Create administrator</Link></>}
      </div>
    </form></div>
  </div>;
}
