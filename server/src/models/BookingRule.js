const { createRepository } = require('../db/repository');

const BookingRule = createRepository({
  table: 'booking_rules',
  booleanFields: ['approvalRequired', 'facultyPriority', 'departmentOnlyAccess'],
  defaults: {
    department: null,
    maxDurationMinutes: 240,
    maxEquipmentQuantityPerItem: 20,
    advanceBookingDays: 30,
    minimumLeadHours: 1,
    approvalRequired: true,
    facultyPriority: true,
    departmentOnlyAccess: false,
    lateReturnRestrictionThreshold: 3,
    lateReturnRestrictionDays: 7,
  },
});

module.exports = { BookingRule };
