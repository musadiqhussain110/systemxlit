const { createRepository } = require('../db/repository');

const ResourceWatch = createRepository({ table: 'resource_watches' });

module.exports = { ResourceWatch };
