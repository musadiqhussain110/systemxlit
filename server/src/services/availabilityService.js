const { Booking } = require('../models/Booking');
const { Equipment } = require('../models/Equipment');
const { Lab } = require('../models/Lab');
const { IssueRecord } = require('../models/IssueRecord');
const { ApiError } = require('../utils/ApiError');
const { dateOnly } = require('../utils/dateTime');

const ACTIVE_STATUSES = ['approved', 'reserved', 'inUse', 'overdue'];

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

async function getConflictingBookings({ bookingDate, startTime, endTime, labId = null, equipmentIds = [], excludeBookingId = null }) {
  if (!labId && !equipmentIds.length) return [];
  const candidates = await Booking.findAll({
    bookingDate: dateOnly(bookingDate),
    status: { $in: ACTIVE_STATUSES },
  });
  const equipmentSet = new Set(equipmentIds.map(String));

  return candidates.filter((booking) => {
    if (excludeBookingId && String(booking._id) === String(excludeBookingId)) return false;
    if (!overlaps(booking.startTime, booking.endTime, startTime, endTime)) return false;
    const sameLab = labId && String(booking.lab || '') === String(labId);
    const sharesEquipment = (booking.equipmentItems || []).some((item) => equipmentSet.has(String(item.equipment)));
    return sameLab || sharesEquipment;
  });
}

async function checkAvailability({ bookingDate, startTime, endTime, labId = null, equipmentItems = [], excludeBookingId = null }) {
  let lab = null;
  if (labId) {
    lab = await Lab.findById(labId);
    if (!lab) throw new ApiError(404, 'Selected lab not found');
    if (['maintenance', 'closed'].includes(lab.status)) throw new ApiError(409, `Lab is currently ${lab.status}`);
    if (lab.availableSlots?.length) {
      const [year, month, day] = dateOnly(bookingDate).split('-').map(Number);
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const insideSchedule = lab.availableSlots.some((slot) => Number(slot.dayOfWeek) === dayOfWeek && slot.startTime <= startTime && slot.endTime >= endTime);
      if (!insideSchedule) throw new ApiError(409, 'Selected time falls outside this lab’s available schedule');
    }
  }

  const equipmentIds = [...new Set(equipmentItems.map((item) => String(item.equipment)))];
  const equipment = equipmentIds.length ? await Equipment.findAll({ _id: { $in: equipmentIds } }) : [];
  if (equipment.length !== equipmentIds.length) throw new ApiError(404, 'One or more equipment items were not found');

  const unavailableEquipment = equipment.find((item) => ['maintenance', 'retired'].includes(item.maintenanceStatus));
  if (unavailableEquipment) throw new ApiError(409, `${unavailableEquipment.name} is not available for booking`);

  const conflicts = await getConflictingBookings({ bookingDate, startTime, endTime, labId, equipmentIds, excludeBookingId });
  const labConflict = labId ? conflicts.some((booking) => String(booking.lab || '') === String(labId)) : false;

  const availability = equipmentItems.map((requested) => {
    const resource = equipment.find((item) => String(item._id) === String(requested.equipment));
    const reserved = conflicts.reduce((sum, booking) => {
      const item = (booking.equipmentItems || []).find((entry) => String(entry.equipment) === String(requested.equipment));
      return sum + (Number(item?.quantity) || 0);
    }, 0);
    const available = Math.max(Number(resource.totalQuantity) - reserved, 0);
    return {
      equipment: resource,
      requested: Number(requested.quantity),
      reserved,
      available,
      sufficient: available >= Number(requested.quantity),
    };
  });

  return { available: !labConflict && availability.every((entry) => entry.sufficient), labConflict, equipment: availability };
}


async function getCurrentIssuedQuantities() {
  const openIssues = await IssueRecord.findAll({ returnedAt: null });
  const quantities = new Map();
  for (const issue of openIssues) {
    for (const item of issue.items || []) {
      const id = String(item.equipment);
      quantities.set(id, (quantities.get(id) || 0) + Number(item.quantity || 0));
    }
  }
  return quantities;
}

async function suggestAlternativeSlots({ bookingDate, startTime, endTime, labId = null, equipmentItems = [], excludeBookingId = null }) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const durationMinutes = (Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3))) - (startHour * 60 + startMinute);
  const suggestions = [];

  for (let offset = 30; offset <= 240 && suggestions.length < 3; offset += 30) {
    const startTotal = startHour * 60 + startMinute + offset;
    const endTotal = startTotal + durationMinutes;
    if (endTotal > 23 * 60 + 59) break;
    const candidateStart = `${String(Math.floor(startTotal / 60)).padStart(2, '0')}:${String(startTotal % 60).padStart(2, '0')}`;
    const candidateEnd = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
    try {
      const result = await checkAvailability({ bookingDate, startTime: candidateStart, endTime: candidateEnd, labId, equipmentItems, excludeBookingId });
      if (result.available) suggestions.push({ bookingDate, startTime: candidateStart, endTime: candidateEnd });
    } catch (error) {
      if (error.statusCode !== 409) throw error;
    }
  }

  return suggestions;
}

module.exports = { ACTIVE_STATUSES, getConflictingBookings, checkAvailability, getCurrentIssuedQuantities, suggestAlternativeSlots };
