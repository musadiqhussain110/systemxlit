const { assertPermission } = require('../middleware/permissions');
const { Booking } = require('../models/Booking');
const { User } = require('../models/User');
const { Equipment } = require('../models/Equipment');
const { Lab } = require('../models/Lab');
const { Department } = require('../models/Department');
const { serializeMutation } = require('../utils/serializeMutation');
const { checkAvailability, suggestAlternativeSlots } = require('./availabilityService');
const { enforceBookingRules } = require('./ruleService');
const { notify, notifyMany } = require('./notificationService');
const { recordActivity } = require('./activityService');
const { ApiError } = require('../utils/ApiError');
const { validateTimeRange, dateOnly } = require('../utils/dateTime');
const { refId } = require('../utils/ids');
const { hydrateBookings } = require('./hydrationService');

const staffRoles = ['labStaff', 'coordinator', 'admin'];

function requireDepartmentForDepartmentRole(user) {
  const departmentId = refId(user.department);
  if (['labStaff', 'coordinator'].includes(user.role) && !departmentId) {
    throw new ApiError(403, 'Your account must be assigned to a department before performing this action');
  }
  return departmentId;
}

async function createBooking(user, payload) {
  assertPermission(user, 'bookings.create');
  validateTimeRange(payload.startTime, payload.endTime);
  const userDepartmentId = refId(user.department);
  const departmentId = payload.department || userDepartmentId;
  if (!departmentId) throw new ApiError(400, 'Department is required');
  if (!payload.lab && !(payload.equipmentItems || []).length) throw new ApiError(400, 'Select a lab, equipment, or both');

  if (!(await Department.findById(departmentId))) throw new ApiError(404, 'Department not found');
  const equipmentItems = payload.equipmentItems || [];
  if (new Set(equipmentItems.map((item) => String(item.equipment))).size !== equipmentItems.length) throw new ApiError(400, 'Select each equipment item only once');
  const selectedLab = payload.lab ? await Lab.findById(payload.lab) : null;
  if (payload.lab && !selectedLab) throw new ApiError(404, 'Selected lab not found');
  const selectedEquipment = await Promise.all(equipmentItems.map((item) => Equipment.findById(item.equipment)));
  if (selectedEquipment.some((item) => !item)) throw new ApiError(404, 'Selected equipment not found');
  if ([selectedLab, ...selectedEquipment].filter(Boolean).some((item) => String(refId(item.department)) !== String(departmentId))) {
    throw new ApiError(400, 'Choose resources from the selected department. Submit a separate request for another department.');
  }
  if (selectedLab && Number(payload.capacity || 1) > Number(selectedLab.capacity)) throw new ApiError(400, `This lab accommodates at most ${selectedLab.capacity} participants`);
  const rule = await enforceBookingRules({ user, departmentId, ...payload, equipmentItems });
  const availability = await checkAvailability({ ...payload, labId: payload.lab || null, equipmentItems });
  if (!availability.available) {
    const suggestions = await suggestAlternativeSlots({ ...payload, labId: payload.lab || null, equipmentItems });
    throw new ApiError(409, 'Selected resources are not fully available', { availability, suggestions });
  }

  const requestedEquipmentIds = [...new Set(equipmentItems.map((item) => String(item.equipment)))];
  const requestedEquipment = requestedEquipmentIds.length ? await Equipment.findAll({ _id: { $in: requestedEquipmentIds } }) : [];
  const needsApproval = Boolean(rule.approvalRequired || requestedEquipment.some((item) => item.approvalRequired));
  const initialPriority = user.role === 'faculty' && rule.facultyPriority ? 'academic' : 'normal';

  const booking = await Booking.create({
    user: user._id,
    department: departmentId,
    lab: payload.lab || null,
    equipmentItems,
    bookingDate: dateOnly(payload.bookingDate),
    startTime: payload.startTime,
    endTime: payload.endTime,
    purpose: payload.purpose,
    priority: initialPriority,
    approvalStatus: needsApproval ? 'pending' : 'approved',
    status: needsApproval ? 'pendingApproval' : 'reserved',
    approvedBy: needsApproval ? null : user._id,
    approvedAt: needsApproval ? null : new Date(),
  });

  if (!needsApproval) await notify(user._id, { type: 'booking-approved', title: 'Booking confirmed', message: 'Your booking has been automatically approved and reserved.', booking: booking._id });

  const staff = await User.findAll({
    role: { $in: staffRoles },
    active: true,
    $or: [{ department: departmentId }, { role: 'admin' }],
  });
  await notifyMany(staff.map((entry) => entry._id), {
    type: 'booking-request', title: 'New booking request', message: `${user.name} submitted a booking request.`, booking: booking._id,
  });
  await recordActivity({ actor: user._id, action: 'booking.created', entityType: 'Booking', entityId: booking._id });
  return booking;
}

async function decideBooking(actor, bookingId, decision, reason = '', priority = null) {
  assertPermission(actor, 'bookings.review');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');

  const actorDepartment = requireDepartmentForDepartmentRole(actor);
  if (String(booking.department) !== String(actorDepartment)) {
    throw new ApiError(403, 'This booking belongs to another department');
  }
  if (booking.approvalStatus !== 'pending' || booking.status !== 'pendingApproval') throw new ApiError(409, 'This booking has already been reviewed');
  if (priority && actor.role !== 'coordinator') {
    throw new ApiError(403, 'Only a department coordinator can change booking priority');
  }

  const updates = {};
  if (priority) updates.priority = priority;
  if (decision === 'approved') {
    const availability = await checkAvailability({
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      labId: booking.lab,
      equipmentItems: booking.equipmentItems,
      excludeBookingId: booking._id,
    });
    if (!availability.available) {
      const suggestions = await suggestAlternativeSlots({ bookingDate: booking.bookingDate, startTime: booking.startTime, endTime: booking.endTime, labId: booking.lab, equipmentItems: booking.equipmentItems });
      throw new ApiError(409, 'Resources are no longer available for this time slot', { availability, suggestions });
    }
    Object.assign(updates, { approvalStatus: 'approved', status: 'reserved', approvedBy: actor._id, approvedAt: new Date(), rejectionReason: '' });
  } else {
    Object.assign(updates, { approvedBy: actor._id, approvedAt: new Date(), approvalStatus: 'rejected', status: 'rejected', rejectionReason: reason || 'Request rejected by reviewer' });
  }

  const updated = await Booking.updateById(booking._id, updates);
  await notify(updated.user, {
    type: `booking-${decision}`,
    title: `Booking ${decision}`,
    message: decision === 'approved' ? 'Your booking request has been approved.' : `Your booking request was rejected: ${updated.rejectionReason}`,
    booking: updated._id,
  });
  await recordActivity({ actor: actor._id, action: `booking.${decision}`, entityType: 'Booking', entityId: updated._id, metadata: { reason, priority: updates.priority || booking.priority } });
  return (await hydrateBookings([updated]))[0];
}

async function cancelBooking(actor, bookingId, reason = '') {
  assertPermission(actor, 'bookings.cancelOwn');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const ownsBooking = String(booking.user) === String(actor._id);
  if (!ownsBooking) throw new ApiError(403, 'You can only cancel your own bookings');
  if (['completed', 'cancelled', 'rejected', 'inUse', 'overdue', 'damaged', 'returnedLate'].includes(booking.status)) throw new ApiError(409, `Booking cannot be cancelled while ${booking.status}`);

  const updated = await Booking.updateById(booking._id, { status: 'cancelled', cancelledAt: new Date(), cancellationReason: reason });
  await notify(updated.user, { type: 'booking-cancelled', title: 'Booking cancelled', message: 'The booking has been cancelled.', booking: updated._id });
  await recordActivity({ actor: actor._id, action: 'booking.cancelled', entityType: 'Booking', entityId: updated._id, metadata: { reason } });
  return updated;
}

module.exports = { createBooking: serializeMutation(createBooking), decideBooking: serializeMutation(decideBooking), cancelBooking: serializeMutation(cancelBooking) };
