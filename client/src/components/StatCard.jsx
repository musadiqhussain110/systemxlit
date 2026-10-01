export function StatCard({ label, value, hint, icon = '•' }) {
  return <article className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value ?? 0}</strong>{hint && <small>{hint}</small>}</div></article>;
}
