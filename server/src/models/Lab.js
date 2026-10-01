const { createRepository } = require('../db/repository');

const Lab = createRepository({
  table: 'labs',
  jsonFields: ['facilities', 'availableSlots'],
  defaults: {
    facilities: [],
    availableSlots: [],
    status: 'available',
    maintenanceNote: '',
  },
});

module.exports = { Lab };
