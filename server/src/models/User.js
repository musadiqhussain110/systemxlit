const { createRepository } = require('../db/repository');

const { roles } = require('../../../shared/rolePermissions.json');
const User = createRepository({
  table: 'users',
  booleanFields: ['active'],
  defaults: {
    role: 'student',
    department: null,
    registrationNumber: '',
    active: true,
    lateReturnCount: 0,
    bookingRestrictedUntil: null,
  },
});

module.exports = { User, roles };
