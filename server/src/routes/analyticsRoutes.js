const { allowPermission } = require('../middleware/permissions');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { summary } = require('../controllers/analyticsController');
router.get('/summary', requireAuth, allowPermission('analytics.read'), summary);
module.exports = router;
