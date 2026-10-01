const { ApiError } = require('./ApiError');

function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) throw new ApiError(400, 'Time must use HH:mm format');
  return Number(match[1]) * 60 + Number(match[2]);
}

function validateTimeRange(startTime, endTime) {
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw new ApiError(400, 'End time must be after start time');
  }
}

function rangesOverlap(startA, endA, startB, endB) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

function dateOnly(dateValue) {
  if (dateValue instanceof Date) return dateValue.toISOString().slice(0, 10);
  const text = String(dateValue || '');
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (match) return match[1];
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) throw new ApiError(400, 'Invalid booking date');
  return parsed.toISOString().slice(0, 10);
}

function dateAtTime(dateValue, timeValue) {
  const [year, month, day] = dateOnly(dateValue).split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

module.exports = { timeToMinutes, validateTimeRange, rangesOverlap, dateOnly, dateAtTime };
