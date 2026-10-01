import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SystemBrand } from '../components/SystemBrand';
import { roleLabel } from '../utils/format';

export function AppLayout() {
  const { user, logout, canBook, can } = useAuth();
  const staff = ['labStaff', 'coordinator', 'admin'].includes(user.role);
  const nav = [
    ['/dashboard', 'Dashboard', '⌂'],
    ...(canBook ? [['/resources', 'Resources', '▦']] : []),
    ...(canBook ? [['/book', 'New Booking', '+']] : []),
    ['/bookings', user.role === 'admin' ? 'Booking Activity' : staff ? 'Booking Requests' : 'My Bookings', '◫'],
    ...(can('issues.manage') ? [['/operations', 'Issue & Return', '⇄']] : []),
    ['/notifications', 'Notifications', '◉'],
  ];
  if (staff) nav.push(['/manage-resources', 'Manage Resources', '⚙']);
  if (can('analytics.read')) nav.push(['/analytics', 'Analytics', '⌁']);
  if (can('rules.manage')) nav.push(['/rules', 'Booking Rules', '◇']);
  if (user.role === 'admin') nav.push(['/users', 'Users', '◎']);
  if (user.role === 'admin') nav.push(['/activity', 'Activity Log', '≡']);

  return <div className="app-shell">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <aside className="sidebar">
      <SystemBrand className="sidebar-brand" subtitle="University Resource Booking" compact />
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Workspace navigation">{nav.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/dashboard'}><span aria-hidden="true">{icon}</span>{label}</NavLink>)}</nav>
      <div className="sidebar-user">
        <div className="avatar">{user.name?.[0] || 'U'}</div>
        <div>
          <strong>{user.name}</strong>
          <span>{roleLabel(user.role)}</span>
        </div>
        <button className="text-button" onClick={logout}>Sign out</button>
      </div>
    </aside>
    <div className="workspace-shell"><header className="workspace-topbar"><span>Campus workspace <span className="topbar-divider">/</span> <strong>{user.department?.name || 'University resources'}</strong></span><div><Link to="/notifications" className="topbar-notifications">Notifications ↗</Link><span className="role-badge">{roleLabel(user.role)}</span></div></header><main id="workspace" className="main-content"><Outlet /></main></div>
  </div>;
}
