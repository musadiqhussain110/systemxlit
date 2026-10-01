const { createRepository } = require('../db/repository');

const Notification = createRepository({
  table: 'notifications',
  defaults: { booking: null, readAt: null },
});

module.exports = { Notification };
