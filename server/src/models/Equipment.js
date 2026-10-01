const { createRepository } = require('../db/repository');

const Equipment = createRepository({
  table: 'equipment',
  aliases: { conditionStatus: 'condition' },
  booleanFields: ['approvalRequired'],
  defaults: {
    lab: null,
    condition: 'good',
    maintenanceStatus: 'operational',
    maintenanceNote: '',
    approvalRequired: false,
  },
});

module.exports = { Equipment };
