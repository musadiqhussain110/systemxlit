const { User } = require('../models/User');
const { Booking } = require('../models/Booking');
const { IssueRecord } = require('../models/IssueRecord');
const { assertPermission } = require('../middleware/permissions');
const { Lab } = require('../models/Lab');
const { Equipment } = require('../models/Equipment');
const { Department } = require('../models/Department');
const { BookingRule } = require('../models/BookingRule');
const { EquipmentCategory } = require('../models/EquipmentCategory');
const { ResourceWatch } = require('../models/ResourceWatch');
const { notifyMany } = require('../services/notificationService');
const { hydrateLabs, hydrateEquipment, hydrateRules } = require('../services/hydrationService');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { refId } = require('../utils/ids');
const { recordActivity } = require('../services/activityService');
const { checkAvailability, getCurrentIssuedQuantities } = require('../services/availabilityService');
const { validateTimeRange } = require('../utils/dateTime');

function hasSlotQuery({ bookingDate, startTime, endTime }) {
  return Boolean(bookingDate && startTime && endTime);
}

function managedDepartment(user) {
  if (user.role === 'admin') return null;
  const departmentId = refId(user.department);
  if (!departmentId) throw new ApiError(403, 'Your account must be assigned to a department before managing resources');
  return departmentId;
}

const listLabs = asyncHandler(async (req, res) => {
  const { search = '', department, status, bookingDate, startTime, endTime } = req.query;
  const query = {};
  if (search) query.$or = [{ name: { $regex: search } }, { code: { $regex: search } }, { location: { $regex: search } }];
  if (department) query.department = department;
  if (status) query.status = status;
  if (['labStaff', 'coordinator'].includes(req.user.role)) {
    const scope = managedDepartment(req.user);
    if (department && String(department) !== String(scope)) throw new ApiError(403, 'You can only access your department resources');
    query.department = scope;
  }
  if (hasSlotQuery({ bookingDate, startTime, endTime })) validateTimeRange(startTime, endTime);
  const rows = await hydrateLabs(await Lab.findAll(query, { orderBy: [['name', 'ASC']] }));

  if (!hasSlotQuery({ bookingDate, startTime, endTime })) {
    return res.json({ success: true, data: rows.map((lab) => ({ ...lab, availableForSlot: lab.status === 'available' })) });
  }

  const data = await Promise.all(rows.map(async (lab) => {
    try {
      const availability = await checkAvailability({ bookingDate, startTime, endTime, labId: lab._id, equipmentItems: [] });
      return { ...lab, availableForSlot: availability.available, availabilityReason: '' };
    } catch (error) {
      if (![404, 409].includes(error.statusCode)) throw error;
      return { ...lab, availableForSlot: false, availabilityReason: error.message };
    }
  }));
  res.json({ success: true, data });
});

const listEquipment = asyncHandler(async (req, res) => {
  const { search = '', department, category, status, bookingDate, startTime, endTime } = req.query;
  const query = {};
  if (search) query.$or = [{ name: { $regex: search } }, { code: { $regex: search } }, { category: { $regex: search } }];
  if (department) query.department = department;
  if (category) query.category = category;
  if (status) query.maintenanceStatus = status;
  if (req.user.role === 'labStaff') {
    const scope = managedDepartment(req.user);
    if (department && String(department) !== String(scope)) throw new ApiError(403, 'You can only access your department resources');
    query.department = scope;
  }
  if (hasSlotQuery({ bookingDate, startTime, endTime })) validateTimeRange(startTime, endTime);
  const rows = await hydrateEquipment(await Equipment.findAll(query, { orderBy: [['name', 'ASC']] }));

  if (!hasSlotQuery({ bookingDate, startTime, endTime })) {
    const issued = await getCurrentIssuedQuantities();
    return res.json({ success: true, data: rows.map((item) => {
      const availableQuantity = ['maintenance', 'retired'].includes(item.maintenanceStatus)
        ? 0
        : Math.max(Number(item.totalQuantity) - Number(issued.get(String(item._id)) || 0), 0);
      return { ...item, availableQuantity, availableForSlot: availableQuantity > 0 };
    }) });
  }

  const data = await Promise.all(rows.map(async (item) => {
    try {
      const availability = await checkAvailability({ bookingDate, startTime, endTime, equipmentItems: [{ equipment: item._id, quantity: 1 }] });
      const slot = availability.equipment[0];
      return { ...item, availableQuantity: slot?.available ?? 0, availableForSlot: availability.available, availabilityReason: '' };
    } catch (error) {
      if (![404, 409].includes(error.statusCode)) throw error;
      return { ...item, availableQuantity: 0, availableForSlot: false, availabilityReason: error.message };
    }
  }));
  res.json({ success: true, data });
});

const listDepartments = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await Department.findAll({}, { orderBy: [['name', 'ASC']] }) });
});

const resourceFields = {
  Lab: ['code', 'name', 'department', 'capacity', 'location', 'facilities', 'availableSlots', 'status', 'maintenanceNote'],
  Equipment: ['code', 'name', 'category', 'department', 'lab', 'totalQuantity', 'condition', 'maintenanceStatus', 'maintenanceNote', 'approvalRequired'],
  Department: ['name', 'code'], EquipmentCategory: ['name', 'code'],
};
function resourcePayload(body, entityType, user, updating = false) {
  const allowed = entityType === 'Lab' && user.role === 'labStaff' ? ['availableSlots', 'status', 'maintenanceNote'] : resourceFields[entityType];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new ApiError(user.role === 'labStaff' && entityType === 'Lab' ? 403 : 400, 'The request includes fields outside your permitted resource controls');
  if (entityType === 'Lab') assertPermission(user, ...(updating ? ['labs.manage', 'labs.availability'] : ['labs.manage']));
  if (entityType === 'Equipment') assertPermission(user, 'equipment.manage');
  if (entityType === 'Department') assertPermission(user, 'departments.manage');
  if (entityType === 'EquipmentCategory') assertPermission(user, 'categories.manage');
  return Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
}
function crudController(Model, entityType) {
  return {
    create: asyncHandler(async (req, res) => {
      const actorDepartment = ['Lab', 'Equipment'].includes(entityType) ? managedDepartment(req.user) : null;
      if (['Lab', 'Equipment'].includes(entityType) && req.user.role !== 'admin') {
        if (String(req.body.department || '') !== String(actorDepartment)) throw new ApiError(403, 'You can only manage resources in your department');
      }
      const payload = resourcePayload(req.body, entityType, req.user);
      if (entityType === 'Equipment' && payload.lab) {
        const lab = await Lab.findById(payload.lab);
        if (!lab || String(lab.department) !== String(actorDepartment)) throw new ApiError(403, 'Equipment must belong to a lab in your assigned department');
      }
      const doc = await Model.create(payload);
      await recordActivity({ actor: req.user._id, action: `${entityType.toLowerCase()}.created`, entityType, entityId: doc._id });
      res.status(201).json({ success: true, data: doc });
    }),
    update: asyncHandler(async (req, res) => {
      const actorDepartment = ['Lab', 'Equipment'].includes(entityType) ? managedDepartment(req.user) : null;
      if (['Lab', 'Equipment'].includes(entityType) && req.user.role !== 'admin') {
        const existing = await Model.findById(req.params.id);
        if (!existing) throw new ApiError(404, `${entityType} not found`);
        if (String(existing.department) !== String(actorDepartment) || (req.body.department && String(req.body.department) !== String(actorDepartment))) {
          throw new ApiError(403, 'You can only manage resources in your department');
        }
      }
      const updates = resourcePayload(req.body, entityType, req.user, true);
      if (entityType === 'Equipment' && updates.lab) {
        const lab = await Lab.findById(updates.lab);
        if (!lab || String(lab.department) !== String(actorDepartment)) throw new ApiError(403, 'Equipment must belong to a lab in your assigned department');
      }

      const doc = await Model.updateById(req.params.id, updates);
      if (!doc) throw new ApiError(404, `${entityType} not found`);
      await recordActivity({ actor: req.user._id, action: `${entityType.toLowerCase()}.updated`, entityType, entityId: doc._id });

      const becameAvailable = (entityType === 'Lab' && updates.status === 'available')
        || (entityType === 'Equipment' && updates.maintenanceStatus === 'operational');
      if (becameAvailable) {
        const resourceType = entityType === 'Lab' ? 'lab' : 'equipment';
        const watches = await ResourceWatch.findAll({ resourceType, resourceId: doc._id });
        if (watches.length) {
          await notifyMany(watches.map((watch) => watch.user), { type: 'resource-available', title: 'Resource available', message: `${doc.name} is available again.` });
          await ResourceWatch.deleteWhere({ resourceType, resourceId: doc._id });
        }
      }
      res.json({ success: true, data: doc });
    }),
    remove: asyncHandler(async (req, res) => {
      assertPermission(req.user, { Lab: 'labs.manage', Equipment: 'equipment.manage', Department: 'departments.manage', EquipmentCategory: 'categories.manage' }[entityType]);
      const actorDepartment = ['Lab', 'Equipment'].includes(entityType) ? managedDepartment(req.user) : null;
      if (['Lab', 'Equipment'].includes(entityType) && req.user.role !== 'admin') {
        const existing = await Model.findById(req.params.id);
        if (!existing) throw new ApiError(404, `${entityType} not found`);
        if (String(existing.department) !== String(actorDepartment)) throw new ApiError(403, 'You can only manage resources in your department');
      }
      if (entityType === 'Department') {
        const referenced = await Promise.all([User.exists({ department: req.params.id }), Lab.exists({ department: req.params.id }), Equipment.exists({ department: req.params.id }), Booking.exists({ department: req.params.id }), BookingRule.exists({ department: req.params.id })]);
        if (referenced.some(Boolean)) throw new ApiError(409, 'This department is assigned to accounts or resources. Reassign them before deleting it.');
      }
      if (entityType === 'Lab') {
        if (await Booking.exists({ lab: req.params.id }) || await Equipment.exists({ lab: req.params.id })) throw new ApiError(409, 'This lab has linked bookings or equipment and must be retained for their records');
      }
      if (entityType === 'Equipment') {
        const records = [...await Booking.findAll(), ...await IssueRecord.findAll()];
        if (records.some(row => [...(row.equipmentItems || []), ...(row.items || [])].some(item => String(item.equipment) === String(req.params.id)))) throw new ApiError(409, 'This equipment has booking or issue history. Retire it instead of deleting its records.');
      }
      if (entityType === 'EquipmentCategory') {
        const category = await EquipmentCategory.findById(req.params.id);
        if (category && await Equipment.exists({ category: category.name })) throw new ApiError(409, 'This category is assigned to equipment. Reassign the equipment first.');
      }
      const doc = await Model.deleteById(req.params.id);
      if (!doc) throw new ApiError(404, `${entityType} not found`);
      await recordActivity({ actor: req.user._id, action: `${entityType.toLowerCase()}.deleted`, entityType, entityId: doc._id });
      res.json({ success: true, data: { id: doc._id } });
    }),
  };
}

const labCrud = crudController(Lab, 'Lab');
const equipmentCrud = crudController(Equipment, 'Equipment');
const departmentCrud = crudController(Department, 'Department');
const categoryCrud = crudController(EquipmentCategory, 'EquipmentCategory');

const listCategories = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await EquipmentCategory.findAll({}, { orderBy: [['name', 'ASC']] }) });
});

const watchResource = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = req.body;
  if (!['lab', 'equipment'].includes(resourceType) || !resourceId) throw new ApiError(400, 'Valid resource type and identifier are required');
  let data = await ResourceWatch.findOne({ user: req.user._id, resourceType, resourceId });
  if (!data) data = await ResourceWatch.create({ user: req.user._id, resourceType, resourceId });
  res.status(201).json({ success: true, data });
});

const listWatches = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await ResourceWatch.findAll({ user: req.user._id }) });
});

const listRules = asyncHandler(async (req, res) => {
  assertPermission(req.user, 'rules.manage');
  const departmentId = managedDepartment(req.user);
  const rows = await BookingRule.findAll({ $or: [{ department: departmentId }, { department: null }] });
  res.json({ success: true, data: await hydrateRules(rows) });
});

const upsertRule = asyncHandler(async (req, res) => {
  assertPermission(req.user, 'rules.manage');
  const department = managedDepartment(req.user);
  if (String(req.body.department || '') !== String(department)) throw new ApiError(403, 'You can only define booking rules for your assigned department');
  const existing = await BookingRule.findOne({ department });
  const fields = ['department', 'maxDurationMinutes', 'maxEquipmentQuantityPerItem', 'advanceBookingDays', 'minimumLeadHours', 'approvalRequired', 'facultyPriority', 'departmentOnlyAccess', 'lateReturnRestrictionThreshold', 'lateReturnRestrictionDays'];
  if (Object.keys(req.body).some(key => !fields.includes(key))) throw new ApiError(400, 'Unsupported booking rule field');
  const payload = { ...req.body, department };
  const data = existing ? await BookingRule.updateById(existing._id, payload) : await BookingRule.create(payload);
  res.json({ success: true, data });
});

module.exports = { listLabs, listEquipment, listDepartments, listCategories, labCrud, equipmentCrud, departmentCrud, categoryCrud, listRules, upsertRule, watchResource, listWatches };
