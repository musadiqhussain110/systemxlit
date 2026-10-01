const { allowPermission } = require('../middleware/permissions');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { list, create, update } = require('../controllers/userController');
router.use(requireAuth, allowPermission('users.manage'));
router.get('/', list);
router.post('/', create);
router.put('/:id', update);
module.exports = router;
