const { createRepository } = require('../db/repository');

const IssueRecord = createRepository({
  table: 'issue_records',
  jsonFields: ['items'],
  defaults: {
    items: [],
    issuedAt: () => new Date(),
    returnedAt: null,
    receivedBy: null,
    remarks: '',
  },
});

module.exports = { IssueRecord };
