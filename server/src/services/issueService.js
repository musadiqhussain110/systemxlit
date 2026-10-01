const { assertPermission } = require('../middleware/permissions');
const { Equipment } = require('../models/Equipment');
const { getCurrentIssuedQuantities } = require('./availabilityService');
const { serializeMutation } = require('../utils/serializeMutation');
const { Booking } = require('../models/Booking');
const { IssueRecord } = require('../models/IssueRecord');
const { User } = require('../models/User');
const { BookingRule } = require('../models/BookingRule');
const { ApiError } = require('../utils/ApiError');
const { dateAtTime } = require('../utils/dateTime');
const { refId } = require('../utils/ids');
const { notify } = require('./notificationService');
const { recordActivity } = require('./activityService');
const { hydrateIssueRecords } = require('./hydrationService');

async function issueBooking(actor, bookingId, remarks = '') {
  assertPermission(actor, 'issues.manage');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  {
    const actorDepartment = refId(actor.department);
    if (!actorDepartment) throw new ApiError(403, 'Your account must be assigned to a department before managing issued resources');
    if (String(booking.department) !== String(actorDepartment)) throw new ApiError(403, 'This booking belongs to another department');
  }
  if (!['approved', 'reserved'].includes(booking.status)) throw new ApiError(409, 'Booking must be approved/reserved before issue');
  if (await IssueRecord.findOne({ booking: booking._id })) throw new ApiError(409, 'Resources have already been issued for this booking');

  const issuedQuantities = await getCurrentIssuedQuantities();
  for (const item of booking.equipmentItems || []) {
    const equipment = await Equipment.findById(item.equipment);
    const remaining = Number(equipment?.totalQuantity || 0) - (issuedQuantities.get(String(item.equipment)) || 0);
    if (!equipment || ['maintenance', 'retired'].includes(equipment.maintenanceStatus) || remaining < Number(item.quantity)) {
      throw new ApiError(409, 'Equipment is unavailable for issue. Check outstanding returns and maintenance.');
    }
  }
  const dueAt = dateAtTime(booking.bookingDate, booking.endTime);
  const record = await IssueRecord.create({
    booking: booking._id,
    items: (booking.equipmentItems || []).map((item) => ({ equipment: item.equipment, quantity: Number(item.quantity), returnCondition: 'good', damageNote: '' })),
    issuedBy: actor._id,
    issuedAt: new Date(),
    dueAt,
    remarks,
  });
  await Booking.updateById(booking._id, { status: 'inUse' });
  await notify(booking.user, { type: 'resource-issued', title: 'Resources issued', message: 'Your reserved resources are now marked in use.', booking: booking._id });
  await recordActivity({ actor: actor._id, action: 'booking.issued', entityType: 'Booking', entityId: booking._id });
  return (await hydrateIssueRecords([record]))[0];
}

async function returnBooking(actor, bookingId, items = [], remarks = '') {
  assertPermission(actor, 'issues.manage');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  {
    const actorDepartment = refId(actor.department);
    if (!actorDepartment) throw new ApiError(403, 'Your account must be assigned to a department before managing issued resources');
    if (String(booking.department) !== String(actorDepartment)) throw new ApiError(403, 'This booking belongs to another department');
  }
  const record = await IssueRecord.findOne({ booking: booking._id });
  if (!record) throw new ApiError(404, 'Issue record not found');
  if (record.returnedAt) throw new ApiError(409, 'Resources have already been returned');

  const itemMap = new Map(items.map((item) => [String(item.equipment), item]));
  let hasDamage = false;
  const returnedItems = (record.items || []).map((issued) => {
    const update = itemMap.get(String(issued.equipment));
    const next = {
      ...issued,
      returnCondition: update?.returnCondition || issued.returnCondition || 'good',
      damageNote: update?.damageNote || issued.damageNote || '',
    };
    if (['damaged', 'missing'].includes(next.returnCondition)) hasDamage = true;
    return next;
  });

  const returnedAt = new Date();
  const wasLate = returnedAt > new Date(record.dueAt);
  const updatedRecord = await IssueRecord.updateById(record._id, {
    items: returnedItems,
    returnedAt,
    receivedBy: actor._id,
    remarks: remarks || record.remarks,
  });

  for (const item of returnedItems.filter((entry) => ['damaged', 'missing'].includes(entry.returnCondition))) {
    await Equipment.updateById(item.equipment, { maintenanceStatus: 'maintenance', maintenanceNote: `Inspection required after ${item.returnCondition} return. ${item.damageNote || ''}` });
  }

  const bookingStatus = hasDamage ? 'damaged' : wasLate ? 'returnedLate' : 'completed';
  await Booking.updateById(booking._id, { status: bookingStatus });

  if (wasLate) {
    const user = await User.findById(booking.user);
    if (user) {
      const lateReturnCount = Number(user.lateReturnCount || 0) + 1;
      const rule = (await BookingRule.findOne({ department: booking.department })) || (await BookingRule.findOne({ department: null }));
      const userUpdates = { lateReturnCount };
      if (rule && lateReturnCount >= Number(rule.lateReturnRestrictionThreshold)) {
        const restrictedUntil = new Date();
        restrictedUntil.setDate(restrictedUntil.getDate() + Number(rule.lateReturnRestrictionDays));
        userUpdates.bookingRestrictedUntil = restrictedUntil;
      }
      await User.updateById(user._id, userUpdates);
    }
  }

  await notify(booking.user, { type: 'resource-returned', title: 'Return recorded', message: `Return completed with status: ${bookingStatus}.`, booking: booking._id });
  await recordActivity({ actor: actor._id, action: 'booking.returned', entityType: 'Booking', entityId: booking._id, metadata: { wasLate, hasDamage } });
  return (await hydrateIssueRecords([updatedRecord]))[0];
}

module.exports = { issueBooking: serializeMutation(issueBooking), returnBooking: serializeMutation(returnBooking) };
