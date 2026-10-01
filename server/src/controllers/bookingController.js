const { checkAvailability, suggestAlternativeSlots } = require('../services/availabilityService');
const { Booking } = require('../models/Booking');
const { createBooking, decideBooking, cancelBooking } = require('../services/bookingService');
const { recommendResources } = require('../services/recommendationService');
const { hydrateBookings } = require('../services/hydrationService');
const { refId } = require('../utils/ids');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

function bookingScope(user) {
  if (user.role === 'admin') return {};
  if (['labStaff', 'coordinator'].includes(user.role)) {
    const departmentId = refId(user.department);
    if (!departmentId) throw new ApiError(403, 'Your account must be assigned to a department before reviewing bookings');
    return { department: departmentId };
  }
  return { user: user._id };
}


const listBookings = asyncHandler(async (req, res) => {
  const query = { ...bookingScope(req.user) };
  const { status, approvalStatus, from, to, user } = req.query;
  if (status) query.status = status;
  if (approvalStatus) query.approvalStatus = approvalStatus;
  if (user && ['admin', 'coordinator', 'labStaff'].includes(req.user.role)) query.user = user;
  if (from || to) {
    query.bookingDate = {};
    if (from) query.bookingDate.$gte = String(from).slice(0, 10);
    if (to) query.bookingDate.$lte = String(to).slice(0, 10);
  }
  const rows = await Booking.findAll(query, { orderBy: [['bookingDate', 'DESC'], ['startTime', 'DESC']] });
  res.json({ success: true, data: await hydrateBookings(rows) });
});

const create = asyncHandler(async (req, res) => {
  const booking = await createBooking(req.user, req.validated.body);
  const populated = (await hydrateBookings([booking]))[0];
  res.status(201).json({ success: true, data: populated });
});

const decide = asyncHandler(async (req, res) => {
  const data = await decideBooking(req.user, req.params.id, req.validated.body.decision, req.validated.body.reason, req.validated.body.priority);
  res.json({ success: true, data });
});

const cancel = asyncHandler(async (req, res) => {
  const data = await cancelBooking(req.user, req.params.id, req.validated.body.reason);
  res.json({ success: true, data });
});

const recommend = asyncHandler(async (req, res) => {
  const data = await recommendResources(req.validated.body);
  res.json({ success: true, data });
});

const conflicts = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const department = refId(req.user.department);
  if (!department || String(booking.department) !== String(department)) throw new ApiError(403, 'You can only handle conflicts in your department');
  const request = { bookingDate: booking.bookingDate, startTime: booking.startTime, endTime: booking.endTime, labId: booking.lab, equipmentItems: booking.equipmentItems, excludeBookingId: booking._id };
  let availability;
  try { availability = await checkAvailability(request); }
  catch (error) { if (error.statusCode !== 409) throw error; availability = { available: false, reason: error.message }; }
  const suggestions = availability.available ? [] : await suggestAlternativeSlots(request);
  res.json({ success: true, data: { availability, suggestions } });
});

module.exports = { conflicts, listBookings, create, decide, cancel, recommend };
