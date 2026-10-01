const router = require('express').Router();
const {
  login,
  setupStatus,
  setupAdmin,
  listRegistrationDepartments,
  register,
  me,
} = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authSchemas } = require('../validators/schemas');
const { requireAuth } = require('../middleware/auth');

router.get('/setup-status', setupStatus);
router.post('/setup-admin', validate(authSchemas.setupAdmin), setupAdmin);
router.get('/registration-departments', listRegistrationDepartments);
router.post('/register', validate(authSchemas.register), register);
router.post('/login', validate(authSchemas.login), login);
router.get('/me', requireAuth, me);

module.exports = router;
