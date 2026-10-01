const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { allowPermission } = require('../middleware/permissions');
const {
  listLabs, listEquipment, listDepartments, listCategories,
  labCrud, equipmentCrud, departmentCrud, categoryCrud,
  listRules, upsertRule, watchResource, listWatches,
} = require('../controllers/resourceController');

router.use(requireAuth);
router.get('/departments', listDepartments);
router.get('/categories', listCategories);
router.get('/labs', allowPermission('labs.read'), listLabs);
router.get('/equipment', allowPermission('equipment.read'), listEquipment);
router.get('/watches', allowPermission('bookings.create'), listWatches);
router.post('/watch', allowPermission('bookings.create'), watchResource);
router.post('/labs', allowPermission('labs.manage'), labCrud.create);
router.put('/labs/:id', allowPermission('labs.manage', 'labs.availability'), labCrud.update);
router.delete('/labs/:id', allowPermission('labs.manage'), labCrud.remove);
router.post('/equipment', allowPermission('equipment.manage'), equipmentCrud.create);
router.put('/equipment/:id', allowPermission('equipment.manage'), equipmentCrud.update);
router.delete('/equipment/:id', allowPermission('equipment.manage'), equipmentCrud.remove);
router.post('/departments', allowPermission('departments.manage'), departmentCrud.create);
router.put('/departments/:id', allowPermission('departments.manage'), departmentCrud.update);
router.delete('/departments/:id', allowPermission('departments.manage'), departmentCrud.remove);
router.post('/categories', allowPermission('categories.manage'), categoryCrud.create);
router.put('/categories/:id', allowPermission('categories.manage'), categoryCrud.update);
router.delete('/categories/:id', allowPermission('categories.manage'), categoryCrud.remove);
router.get('/rules', allowPermission('rules.manage'), listRules);
router.put('/rules', allowPermission('rules.manage'), upsertRule);
module.exports = router;
