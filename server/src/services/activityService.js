const { ActivityLog } = require('../models/ActivityLog');

async function recordActivity({ actor, action, entityType, entityId, metadata = {} }) {
  return ActivityLog.create({ actor: actor || null, action, entityType, entityId, metadata });
}

module.exports = { recordActivity };
