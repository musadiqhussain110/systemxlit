export function dateLabel(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium' }).format(new Date(value));
}

export function dateTimeLabel(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function roleLabel(role = '') {
  return ({ labStaff: 'Lab Staff / Lab Incharge', coordinator: 'Department Coordinator', admin: 'Administrator', faculty: 'Faculty', student: 'Student' })[role] || role;
}

export function statusLabel(status = '') {
  return status.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}
