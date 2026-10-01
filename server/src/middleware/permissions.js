const policy = require('../../../shared/rolePermissions.json');
const { ApiError } = require('../utils/ApiError');
function hasPermission(user, capability) {
  return Boolean(policy.capabilities[capability]?.includes(user?.role));
}
function assertPermission(user, ...capabilities) {
  if (!capabilities.some(capability => hasPermission(user, capability))) throw new ApiError(403, 'This action is not permitted for your assigned role');
}
const allowPermission = (...capabilities) => (req, _res, next) => {
  try { assertPermission(req.user, ...capabilities); next(); } catch (error) { next(error); }
};
module.exports = { hasPermission, assertPermission, allowPermission };
