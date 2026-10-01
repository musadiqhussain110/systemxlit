const { Notification } = require('../models/Notification');

async function notify(user, { type, title, message, booking = null }) {
  if (!user) return null;
  return Notification.create({ user, type, title, message, booking });
}

async function notifyMany(users, payload) {
  const uniqueIds = [...new Set(users.filter(Boolean).map(String))];
  if (!uniqueIds.length) return [];
  return Notification.insertMany(uniqueIds.map((user) => ({ user, ...payload })));
}

module.exports = { notify, notifyMany };
