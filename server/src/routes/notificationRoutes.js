const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { list, markRead, markAllRead } = require('../controllers/notificationController');
router.use(requireAuth);
router.get('/', list);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
module.exports = router;
