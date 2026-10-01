const { validateTimeRange } = require('../utils/dateTime');
const { Lab } = require('../models/Lab');
const { hydrateLabs } = require('./hydrationService');
const { checkAvailability } = require('./availabilityService');

function scoreLab({ lab, departmentId, capacity = 1, availability, purpose = '' }) {
  if (!availability.available) return 0;
  let score = 55;
  if (String(lab.department?._id || lab.department) === String(departmentId)) score += 15;
  if (Number(lab.capacity) >= Number(capacity)) {
    const excess = Math.max(Number(lab.capacity) - Number(capacity), 0);
    score += Math.max(5, 20 - Math.min(excess, 15));
  }
  if (lab.status === 'available') score += 5;
  const purposeTokens = purpose.toLowerCase().split(/\W+/).filter((token) => token.length > 3);
  const resourceText = `${lab.name} ${(lab.facilities || []).join(' ')}`.toLowerCase();
  if (purposeTokens.some((token) => resourceText.includes(token))) score += 5;
  return Math.min(score, 100);
}

async function recommendResources({ bookingDate, startTime, endTime, departmentId, capacity = 1, equipmentItems = [], purpose = '' }) {
  validateTimeRange(startTime, endTime);
  const rawLabs = await Lab.findAll({ department: departmentId, status: { $nin: ['closed', 'maintenance'] }, capacity: { $gte: capacity } });
  const labs = await hydrateLabs(rawLabs);

  const recommendations = await Promise.all(labs.map(async (lab) => {
    try {
      const availability = await checkAvailability({ bookingDate, startTime, endTime, labId: lab._id, equipmentItems });
      return {
        lab,
        available: availability.available,
        score: scoreLab({ lab, departmentId, capacity, availability, purpose }),
        equipmentAvailability: availability.equipment.map((item) => ({
          equipmentId: item.equipment._id,
          name: item.equipment.name,
          requested: item.requested,
          available: item.available,
          sufficient: item.sufficient,
        })),
      };
    } catch (error) {
      if (![404, 409].includes(error.statusCode)) throw error;
      return { lab, available: false, score: 0, equipmentAvailability: [], reason: error.message };
    }
  }));

  return recommendations.sort((a, b) => b.score - a.score);
}

module.exports = { recommendResources };
