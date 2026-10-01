const bcrypt = require('bcryptjs');
const { User, roles } = require('../models/User');
const { Department } = require('../models/Department');
const { hydrateUsers } = require('../services/hydrationService');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

function validateUserFields(body) {
  const fields = ['name', 'email', 'password', 'role', 'department', 'registrationNumber', 'active'];
  if (Object.keys(body).some(key => !fields.includes(key))) throw new ApiError(400, 'Permissions are assigned through a defined role only; unsupported account fields are not accepted');
}

async function validateUserAssignment({ role, department, registrationNumber }) {
  if (!roles.includes(role)) throw new ApiError(400, 'Invalid role');

  if (role !== 'admin') {
    if (!department) throw new ApiError(400, 'A department is required for this role');
    if (!(await Department.exists({ _id: department }))) throw new ApiError(400, 'Selected department does not exist');
  }

  if (role === 'student' && !String(registrationNumber || '').trim()) {
    throw new ApiError(400, 'Registration number is required for students');
  }
}

const list = asyncHandler(async (_req, res) => {
  const rows = await User.findAll({}, { orderBy: [['name', 'ASC']] });
  res.json({ success: true, data: await hydrateUsers(rows) });
});

const create = asyncHandler(async (req, res) => {
  validateUserFields(req.body);
  const { name, email, password, role = 'student', department = null, registrationNumber = '' } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required');
  await validateUserAssignment({ role, department, registrationNumber });

  const normalizedEmail = email.toLowerCase();
  if (await User.exists({ email: normalizedEmail })) throw new ApiError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    department: role === 'admin' ? null : department,
    registrationNumber: role === 'student' ? registrationNumber.trim() : String(registrationNumber || '').trim(),
  });
  const data = (await hydrateUsers([user]))[0];
  res.status(201).json({ success: true, data });
});

const update = asyncHandler(async (req, res) => {
  validateUserFields(req.body);
  const existing = await User.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'User not found');

  const nextRole = req.body.role || existing.role;
  const nextDepartment = Object.prototype.hasOwnProperty.call(req.body, 'department') ? req.body.department : existing.department;
  const nextRegistrationNumber = Object.prototype.hasOwnProperty.call(req.body, 'registrationNumber') ? req.body.registrationNumber : existing.registrationNumber;
  await validateUserAssignment({ role: nextRole, department: nextRole === 'admin' ? null : nextDepartment, registrationNumber: nextRegistrationNumber });

  const updates = { ...req.body };
  delete updates.password;
  if (updates.email) {
    updates.email = updates.email.toLowerCase();
    const duplicate = await User.findOne({ email: updates.email });
    if (duplicate && String(duplicate._id) !== String(existing._id)) throw new ApiError(409, 'An account with this email already exists');
  }
  if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 12);
  if (nextRole === 'admin') updates.department = null;

  const user = await User.updateById(req.params.id, updates);
  const data = (await hydrateUsers([user]))[0];
  res.json({ success: true, data });
});

module.exports = { list, create, update };
