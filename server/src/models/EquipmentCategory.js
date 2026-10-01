const { createRepository } = require('../db/repository');

const EquipmentCategory = createRepository({ table: 'equipment_categories' });

module.exports = { EquipmentCategory };
