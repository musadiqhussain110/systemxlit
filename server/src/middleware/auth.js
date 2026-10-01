const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { User, roles } = require('../models/User');
const { hydrateUsers } = require('../services/hydrationService');
const { ApiError } = require('../utils/ApiError');
const { asyncHandler } = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');

  let payload;
  try { payload = jwt.verify(token, env.jwtSecret); }
  catch { throw new ApiError(401, 'Invalid or expired token'); }

  const rawUser = await User.findById(payload.sub);
  if (!rawUser || !rawUser.active) throw new ApiError(401, 'User account is unavailable');
  if (!roles.includes(rawUser.role)) throw new ApiError(403, 'Account has an unsupported role assignment');
  req.user = (await hydrateUsers([rawUser]))[0];
  next();
});

const allowRoles = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'Insufficient permission'));
  return next();
};

module.exports = { requireAuth, allowRoles };
