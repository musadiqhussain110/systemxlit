export function EmptyState({ title = 'Nothing here yet', text = 'No matching records were found.' }) {
  return <div className="empty-state"><div className="empty-icon">◇</div><strong>{title}</strong><p>{text}</p></div>;
}
