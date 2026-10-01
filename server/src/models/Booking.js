const { createRepository } = require('../db/repository');

const Booking = createRepository({
  table: 'bookings',
  jsonFields: ['equipmentItems'],
  defaults: {
    lab: null,
    equipmentItems: [],
    priority: 'normal',
    approvalStatus: 'pending',
    status: 'pendingApproval',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: '',
    cancelledAt: null,
    cancellationReason: '',
  },
});

module.exports = { Booking };
