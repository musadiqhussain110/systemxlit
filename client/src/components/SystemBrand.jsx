import logo from '../assets/hackathon.png';
export function SystemBrand({ subtitle = 'University Resource Booking', className = '', compact = false }) {
  return <div className={`system-brand ${compact ? 'compact' : ''} ${className}`.trim()}>
    <span className="logo-window"><img src={logo} alt="SystemXLit" className="system-brand-logo" /></span>
    {subtitle && <span className="system-brand-subtitle">{subtitle}</span>}
  </div>;
}
