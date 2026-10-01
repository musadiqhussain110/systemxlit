const { createRepository } = require('../db/repository');

const ActivityLog = createRepository({
  table: 'activity_logs',
  jsonFields: ['metadata'],
  defaults: { actor: null, metadata: {} },
});

module.exports = { ActivityLog };
