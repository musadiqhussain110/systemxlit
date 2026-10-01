const { assertPermission } = require('../middleware/permissions');
const { ApiError } = require('../utils/ApiError');
const { Booking } = require('../models/Booking');
const { IssueRecord } = require('../models/IssueRecord');
const { Lab } = require('../models/Lab');
const { Equipment } = require('../models/Equipment');
const { Department } = require('../models/Department');
const { refId, uniqueIds } = require('../utils/ids');
const { dateOnly, timeToMinutes } = require('../utils/dateTime');

function bookingScope(user) {
  if (user.role === 'admin') return {};
  if (['coordinator', 'labStaff'].includes(user.role) && refId(user.department)) return { department: refId(user.department) };
  return { user: user._id };
}

function labScope(user, bookings) {
  if (user.role === 'admin') return {};
  if (['coordinator', 'labStaff'].includes(user.role) && refId(user.department)) return { department: refId(user.department) };
  return { _id: { $in: uniqueIds(bookings.map((booking) => booking.lab)) } };
}

function topEntries(map, limit = 5) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function minutesBetween(startTime, endTime) {
  return Math.max(timeToMinutes(endTime) - timeToMinutes(startTime), 0);
}

function calculateAvailableMinutes(labs, startDate, days) {
  let total = 0;
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    const dayOfWeek = date.getDay();
    for (const lab of labs) {
      for (const slot of lab.availableSlots || []) {
        if (Number(slot.dayOfWeek) === dayOfWeek) total += minutesBetween(slot.startTime, slot.endTime);
      }
    }
  }
  return total;
}

async function getAnalytics(user) {
  assertPermission(user, 'analytics.read');
  if (user.role === 'coordinator' && !refId(user.department)) throw new ApiError(403, 'A department assignment is required to monitor usage');
  const bookings = await Booking.findAll(bookingScope(user));
  const byStatus = bookings.reduce((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});

  const activeBookings = bookings.filter((booking) => !['cancelled', 'rejected'].includes(booking.status));
  const labCounts = new Map();
  const equipmentQuantities = new Map();
  const departmentCounts = new Map();
  const monthlyCounts = new Map();
  const peakHours = new Map();
  const rejectionReasons = new Map();

  for (const booking of bookings) {
    departmentCounts.set(String(booking.department), (departmentCounts.get(String(booking.department)) || 0) + 1);
    const label = dateOnly(booking.bookingDate).slice(0, 7);
    monthlyCounts.set(label, (monthlyCounts.get(label) || 0) + 1);
    if (booking.startTime) {
      const hour = `${String(Number(booking.startTime.slice(0, 2))).padStart(2, '0')}:00`;
      peakHours.set(hour, (peakHours.get(hour) || 0) + 1);
    }
    if (booking.status === 'rejected' && booking.rejectionReason) {
      const reason = booking.rejectionReason.trim();
      rejectionReasons.set(reason, (rejectionReasons.get(reason) || 0) + 1);
    }
  }

  for (const booking of activeBookings) {
    if (booking.lab) labCounts.set(String(booking.lab), (labCounts.get(String(booking.lab)) || 0) + 1);
    for (const item of booking.equipmentItems || []) {
      const id = String(item.equipment);
      equipmentQuantities.set(id, (equipmentQuantities.get(id) || 0) + Number(item.quantity || 0));
    }
  }

  const [labs, equipment, departments, scopedLabs] = await Promise.all([
    Lab.findAll({ _id: { $in: uniqueIds([...labCounts.keys()]) } }),
    Equipment.findAll({ _id: { $in: uniqueIds([...equipmentQuantities.keys()]) } }),
    Department.findAll({ _id: { $in: uniqueIds([...departmentCounts.keys()]) } }),
    Lab.findAll(labScope(user, bookings)),
  ]);
  const labMap = new Map(labs.map((row) => [String(row._id), row]));
  const equipmentMap = new Map(equipment.map((row) => [String(row._id), row]));
  const departmentMap = new Map(departments.map((row) => [String(row._id), row]));

  const bookingIds = new Set(bookings.map((booking) => String(booking._id)));
  const allIssueRecords = await IssueRecord.findAll();
  const issueRecords = user.role === 'admin' ? allIssueRecords : allIssueRecords.filter((issue) => bookingIds.has(String(issue.booking)));
  const openIssues = issueRecords.filter((issue) => !issue.returnedAt);
  const now = new Date();

  const damageReports = issueRecords.reduce((count, issue) => count + (issue.items || []).filter((item) => ['damaged', 'missing'].includes(item.returnCondition)).length, 0);

  const utilizationDays = 30;
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  periodStart.setDate(periodStart.getDate() - (utilizationDays - 1));
  const periodStartText = dateOnly(periodStart);
  const todayText = dateOnly(now);
  const bookedMinutes = activeBookings.reduce((sum, booking) => {
    if (!booking.lab) return sum;
    const bookingDay = dateOnly(booking.bookingDate);
    if (bookingDay < periodStartText || bookingDay > todayText) return sum;
    return sum + minutesBetween(booking.startTime, booking.endTime);
  }, 0);
  const availableMinutes = calculateAvailableMinutes(scopedLabs, periodStart, utilizationDays);
  const averageLabUtilization = availableMinutes > 0 ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 1000) / 10) : 0;

  const scopedLabCounts = scopedLabs.map((lab) => ({ name: lab.name, bookings: labCounts.get(String(lab._id)) || 0 }));

  return {
    totals: {
      total: bookings.length,
      approved: (byStatus.approved || 0) + (byStatus.reserved || 0) + (byStatus.inUse || 0) + (byStatus.completed || 0) + (byStatus.returnedLate || 0) + (byStatus.damaged || 0),
      pending: byStatus.pendingApproval || 0,
      cancelled: byStatus.cancelled || 0,
      currentlyIssued: openIssues.length,
      overdue: openIssues.filter((issue) => new Date(issue.dueAt) < now).length,
      damaged: byStatus.damaged || 0,
      damageReports,
      averageLabUtilization,
    },
    mostBookedLabs: topEntries(labCounts).map(([id, bookingsCount]) => ({ name: labMap.get(id)?.name || 'Unknown lab', bookings: bookingsCount })),
    mostUsedEquipment: topEntries(equipmentQuantities).map(([id, quantity]) => ({ name: equipmentMap.get(id)?.name || 'Unknown equipment', quantity })),
    usageByDepartment: topEntries(departmentCounts, departmentCounts.size).map(([id, bookingsCount]) => ({ name: departmentMap.get(id)?.name || 'Unknown department', bookings: bookingsCount })),
    monthlyUsage: [...monthlyCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, bookingsCount]) => ({ label, bookings: bookingsCount })),
    peakBookingHours: topEntries(peakHours, 5).map(([label, bookingsCount]) => ({ label, bookings: bookingsCount })),
    underusedLabs: scopedLabCounts.sort((a, b) => a.bookings - b.bookings || a.name.localeCompare(b.name)).slice(0, 5),
    rejectionReasons: topEntries(rejectionReasons, 5).map(([reason, count]) => ({ reason, count })),
  };
}

module.exports = { getAnalytics };
