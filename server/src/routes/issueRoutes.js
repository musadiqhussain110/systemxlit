const { allowPermission } = require('../middleware/permissions');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { listIssues, issue, returnResources } = require('../controllers/issueController');

router.use(requireAuth, allowPermission('issues.manage'));
router.get('/', listIssues);
router.post('/:bookingId/issue', issue);
router.patch('/:bookingId/return', returnResources);
module.exports = router;
