const cron = require('node-cron');
const { env } = require('../config/env');
const { Booking } = require('../models/Booking');
const { IssueRecord } = require('../models/IssueRecord');
const { Notification } = require('../models/Notification');
const { notify } = require('../services/notificationService');
const { dateAtTime } = require('../utils/dateTime');

async function notificationExists(user, type, booking, since) {
  return Notification.exists({ user, type, booking, createdAt: { $gte: since } });
}

async function runReminders() {
  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  const today = now.toISOString().slice(0, 10);
  const tomorrowCandidate = nextHour.toISOString().slice(0, 10);
  const dates = today === tomorrowCandidate ? [today] : [today, tomorrowCandidate];
  const bookings = await Booking.findAll({ status: 'reserved', bookingDate: { $in: dates } });

  for (const booking of bookings) {
    const startsAt = dateAtTime(booking.bookingDate, booking.startTime);
    const since = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    if (startsAt >= now && startsAt <= nextHour && !(await notificationExists(booking.user, 'booking-reminder', booking._id, since))) {
      await notify(booking.user, { type: 'booking-reminder', title: 'Booking starts soon', message: `Your booking starts at ${booking.startTime}.`, booking: booking._id });
    }
  }

  const issues = await IssueRecord.findAll({ returnedAt: null, dueAt: { $lte: nextHour } });
  for (const issue of issues) {
    const booking = await Booking.findById(issue.booking);
    if (!booking) continue;
    const overdue = new Date(issue.dueAt) < now;
    const type = overdue ? 'equipment-overdue' : 'return-reminder';
    const since = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    if (!(await notificationExists(booking.user, type, booking._id, since))) {
      await notify(booking.user, {
        type,
        title: overdue ? 'Equipment overdue' : 'Return due soon',
        message: overdue ? 'One or more issued resources are overdue.' : 'Your equipment return time is approaching.',
        booking: booking._id,
      });
    }
    if (overdue && booking.status === 'inUse') await Booking.updateById(booking._id, { status: 'overdue' });
  }
}

function startReminderJob() {
  cron.schedule(env.reminderCron, () => runReminders().catch((error) => console.error('Reminder job failed:', error)));
}

module.exports = { startReminderJob, runReminders };
