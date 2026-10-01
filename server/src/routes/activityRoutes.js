const { allowPermission } = require('../middleware/permissions');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { list } = require('../controllers/activityController');
router.get('/', requireAuth, allowPermission('activity.read'), list);
module.exports = router;
