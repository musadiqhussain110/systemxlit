const { allowPermission } = require('../middleware/permissions');
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { bookingSchemas } = require('../validators/schemas');
const { listBookings, create, decide, cancel, recommend, conflicts } = require('../controllers/bookingController');

router.use(requireAuth);
router.get('/', listBookings);
router.post('/', allowPermission('bookings.create'), validate(bookingSchemas.create), create);
router.post('/recommendations', allowPermission('bookings.create'), validate(bookingSchemas.recommend), recommend);
router.patch('/:id/decision', allowPermission('bookings.review'), validate(bookingSchemas.decision), decide);
router.patch('/:id/cancel', allowPermission('bookings.cancelOwn'), validate(bookingSchemas.cancel), cancel);
router.get('/:id/conflicts', allowPermission('bookings.conflicts'), conflicts);
module.exports = router;
