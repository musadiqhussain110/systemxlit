function refId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id;
  return String(value);
}

function uniqueIds(values = []) {
  return [...new Set(values.map(refId).filter(Boolean))];
}

module.exports = { refId, uniqueIds };
