const { Notification } = require('../models/Notification');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const data = await Notification.findAll({ user: req.user._id }, { orderBy: [['createdAt', 'DESC']], limit: 100 });
  res.json({ success: true, data });
});

const markRead = asyncHandler(async (req, res) => {
  const existing = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!existing) throw new ApiError(404, 'Notification not found');
  const data = await Notification.updateById(existing._id, { readAt: new Date() });
  res.json({ success: true, data });
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateWhere({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
});

module.exports = { list, markRead, markAllRead };
