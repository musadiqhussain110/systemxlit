const { ApiError } = require('../utils/ApiError');

function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, _req, res, _next) {
  const message = String(err?.message || '');

  if (err?.code === 'ERR_SQLITE_ERROR' && (err?.errcode === 2067 || message.includes('UNIQUE constraint failed'))) {
    err = new ApiError(409, 'A record with that unique value already exists');
  } else if (err?.code === 'ERR_SQLITE_ERROR' && (err?.errcode === 1299 || message.includes('NOT NULL constraint failed'))) {
    err = new ApiError(400, 'One or more required values are missing');
  } else if (err?.code === 'ERR_SQLITE_ERROR' && message.includes('CHECK constraint failed')) {
    err = new ApiError(400, 'One or more values are invalid');
  }

  const status = err.statusCode || 500;
  const body = { success: false, message: err.message || 'Internal server error' };
  if (err.details) body.details = err.details;
  if (process.env.NODE_ENV !== 'production' && status === 500) body.stack = err.stack;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
