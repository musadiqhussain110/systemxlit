const { ActivityLog } = require('../models/ActivityLog');
const { hydrateActivities } = require('../services/hydrationService');
const { asyncHandler } = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 250);
  const rows = await ActivityLog.findAll({ entityType: 'Booking' }, { orderBy: [['createdAt', 'DESC']], limit });
  res.json({ success: true, data: await hydrateActivities(rows) });
});

module.exports = { list };
