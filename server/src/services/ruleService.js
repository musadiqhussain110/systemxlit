const { BookingRule } = require('../models/BookingRule');
const { ApiError } = require('../utils/ApiError');
const { refId } = require('../utils/ids');
const { timeToMinutes, dateAtTime } = require('../utils/dateTime');

async function getApplicableRule(departmentId) {
  return (await BookingRule.findOne({ department: departmentId }))
    || (await BookingRule.findOne({ department: null }))
    || { maxDurationMinutes: 240, maxEquipmentQuantityPerItem: 20, advanceBookingDays: 30, minimumLeadHours: 1, approvalRequired: true };
}

async function enforceBookingRules({ user, departmentId, bookingDate, startTime, endTime, equipmentItems }) {
  const rule = await getApplicableRule(departmentId);
  if (rule.departmentOnlyAccess && ['student', 'faculty'].includes(user.role) && String(refId(user.department) || '') !== String(departmentId)) {
    throw new ApiError(403, 'This department accepts bookings only from its own students and faculty');
  }
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (duration > rule.maxDurationMinutes) throw new ApiError(400, `Maximum booking duration is ${rule.maxDurationMinutes} minutes`);

  const startDateTime = dateAtTime(bookingDate, startTime);
  const now = new Date();
  if (startDateTime <= now) throw new ApiError(400, 'Booking time must be in the future');

  const hoursUntil = (startDateTime - now) / 3_600_000;
  if (hoursUntil < rule.minimumLeadHours) throw new ApiError(400, `Bookings require at least ${rule.minimumLeadHours} hour(s) notice`);

  const daysUntil = (startDateTime - now) / 86_400_000;
  if (daysUntil > rule.advanceBookingDays) throw new ApiError(400, `Bookings can only be made ${rule.advanceBookingDays} days in advance`);

  const tooMany = equipmentItems.find((item) => item.quantity > rule.maxEquipmentQuantityPerItem);
  if (tooMany) throw new ApiError(400, `Maximum quantity per equipment item is ${rule.maxEquipmentQuantityPerItem}`);

  if (user.bookingRestrictedUntil && new Date(user.bookingRestrictedUntil) > now) {
    throw new ApiError(403, `Booking access is restricted until ${new Date(user.bookingRestrictedUntil).toISOString()}`);
  }
  return rule;
}

module.exports = { getApplicableRule, enforceBookingRules };
