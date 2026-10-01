const { createRepository } = require('../db/repository');

const Department = createRepository({ table: 'departments' });

module.exports = { Department };
