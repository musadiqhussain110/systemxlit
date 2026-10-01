const { IssueRecord } = require('../models/IssueRecord');
const { Booking } = require('../models/Booking');
const { issueBooking, returnBooking } = require('../services/issueService');
const { hydrateIssueRecords } = require('../services/hydrationService');
const { refId } = require('../utils/ids');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const listIssues = asyncHandler(async (req, res) => {
  let query = {};
  if (req.user.role !== 'admin') {
    const departmentId = refId(req.user.department);
    if (!departmentId) throw new ApiError(403, 'Your account must be assigned to a department before managing issued resources');
    const bookings = await Booking.findAll({ department: departmentId });
    query = { booking: { $in: bookings.map((booking) => booking._id) } };
  }
  const rows = await IssueRecord.findAll(query, { orderBy: [['issuedAt', 'DESC']] });
  res.json({ success: true, data: await hydrateIssueRecords(rows) });
});

const issue = asyncHandler(async (req, res) => {
  const data = await issueBooking(req.user, req.params.bookingId, req.body.remarks || '');
  res.status(201).json({ success: true, data });
});

const returnResources = asyncHandler(async (req, res) => {
  const data = await returnBooking(req.user, req.params.bookingId, req.body.items || [], req.body.remarks || '');
  res.json({ success: true, data });
});

module.exports = { listIssues, issue, returnResources };
