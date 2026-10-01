import { statusLabel } from '../utils/format';

export function StatusPill({ value }) {
  const normalized = (value || 'unknown').toLowerCase();
  return <span className={`status-pill status-${normalized}`}>{statusLabel(value)}</span>;
}
