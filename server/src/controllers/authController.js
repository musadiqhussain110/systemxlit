const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const { Department } = require('../models/Department');
const { env } = require('../config/env');
const { ApiError } = require('../utils/ApiError');
const { asyncHandler } = require('../utils/asyncHandler');
const { hydrateUsers } = require('../services/hydrationService');
const { recordActivity } = require('../services/activityService');

function createToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

async function authPayload(rawUser) {
  const user = (await hydrateUsers([rawUser]))[0];
  return {
    token: createToken(rawUser),
    user: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      registrationNumber: user.registrationNumber,
    },
  };
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const rawUser = await User.findOne({ email: email.toLowerCase(), active: true });
  if (!rawUser || !(await bcrypt.compare(password, rawUser.passwordHash))) throw new ApiError(401, 'Invalid email or password');
  res.json({ success: true, data: await authPayload(rawUser) });
});

const setupStatus = asyncHandler(async (_req, res) => {
  const userCount = await User.count();
  res.json({ success: true, data: { needsAdminSetup: userCount === 0 } });
});

const setupAdmin = asyncHandler(async (req, res) => {
  if ((await User.count()) !== 0) throw new ApiError(409, 'Initial administrator setup has already been completed');

  const { name, email, password } = req.validated.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash,
    role: 'admin',
    department: null,
    registrationNumber: '',
  });

  await recordActivity({ actor: user._id, action: 'created initial administrator', entityType: 'user', entityId: user._id });
  res.status(201).json({ success: true, data: await authPayload(user) });
});

const listRegistrationDepartments = asyncHandler(async (_req, res) => {
  const departments = await Department.findAll({}, { orderBy: [['name', 'ASC']] });
  res.json({ success: true, data: departments });
});

const register = asyncHandler(async (req, res) => {
  if ((await User.count()) === 0) throw new ApiError(409, 'University setup must be completed by an administrator before registration opens');

  const { name, email, password, role, department, registrationNumber = '' } = req.validated.body;
  if (!['student', 'faculty'].includes(role)) throw new ApiError(400, 'Public registration is available only for students and faculty');

  const normalizedEmail = email.toLowerCase();
  if (await User.exists({ email: normalizedEmail })) throw new ApiError(409, 'An account with this email already exists');
  if (!(await Department.exists({ _id: department }))) throw new ApiError(400, 'Selected department does not exist');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    department,
    registrationNumber: registrationNumber.trim(),
  });

  await recordActivity({ actor: user._id, action: 'registered account', entityType: 'user', entityId: user._id, metadata: { role } });
  res.status(201).json({ success: true, data: await authPayload(user) });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = { login, setupStatus, setupAdmin, listRegistrationDepartments, register, me };
