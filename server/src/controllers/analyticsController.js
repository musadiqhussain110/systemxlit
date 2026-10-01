const { getAnalytics } = require('../services/analyticsService');
const { asyncHandler } = require('../utils/asyncHandler');

const summary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getAnalytics(req.user) });
});

module.exports = { summary };
