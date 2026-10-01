const { ApiError } = require('../utils/ApiError');

const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!result.success) {
    const issues = result.error.issues.map(({ path, message }) => ({
      field: path.filter((part) => !['body', 'query', 'params'].includes(part)).join('.'),
      message,
    }));
    const message = issues.map((issue) => `${issue.field || 'Request'}: ${issue.message}`).join('; ');
    return next(new ApiError(400, message, { ...result.error.flatten(), issues }));
  }
  req.validated = result.data;
  return next();
};

module.exports = { validate };
