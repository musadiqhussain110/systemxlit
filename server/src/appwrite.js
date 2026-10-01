const request = require('supertest');
const { app } = require('./app');
const { connectDatabase } = require('./config/db');
const { env } = require('./config/env');
const { runReminders } = require('./jobs/reminderJob');

let databasePromise = null;

function ensureDatabase() {
  if (!databasePromise) {
    databasePromise = connectDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': env.clientOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}

function responseHeaders(headers = {}) {
  const result = corsHeaders();
  for (const key of ['content-type', 'cache-control', 'etag']) {
    if (headers[key]) result[key] = headers[key];
  }
  return result;
}

module.exports = async ({ req, res, log, error }) => {
  try {
    await ensureDatabase();

    if (req.headers?.['x-appwrite-trigger'] === 'schedule') {
      await runReminders();
      return res.json({ success: true, message: 'Reminder job completed' }, 200);
    }

    if (req.method === 'OPTIONS') {
      return res.text('', 204, corsHeaders());
    }

    const method = String(req.method || 'GET').toLowerCase();
    const supported = new Set(['get', 'post', 'put', 'patch', 'delete', 'head']);
    if (!supported.has(method)) {
      return res.json({ success: false, message: 'Method not allowed' }, 405, corsHeaders());
    }

    let forwarded = request(app)[method](req.path || '/');
    if (req.query && Object.keys(req.query).length) forwarded = forwarded.query(req.query);

    for (const [key, value] of Object.entries(req.headers || {})) {
      const lower = key.toLowerCase();
      if (lower.startsWith('x-appwrite-') || ['host', 'content-length', 'connection'].includes(lower)) continue;
      if (value !== undefined && value !== null) forwarded = forwarded.set(key, String(value));
    }

    if (!['get', 'head'].includes(method)) {
      if (req.bodyJson !== undefined && req.bodyJson !== null) forwarded = forwarded.send(req.bodyJson);
      else if (req.bodyText) forwarded = forwarded.send(req.bodyText);
    }

    const response = await forwarded;
    const headers = responseHeaders(response.headers);
    log(`${req.method} ${req.path} -> ${response.statusCode}`);

    if (response.statusCode === 204) return res.text('', 204, headers);
    if (response.body && typeof response.body === 'object' && Object.keys(response.body).length) {
      return res.json(response.body, response.statusCode, headers);
    }

    try {
      return res.json(JSON.parse(response.text || '{}'), response.statusCode, headers);
    } catch {
      return res.text(response.text || '', response.statusCode, headers);
    }
  } catch (err) {
    error(err.stack || err.message || String(err));
    return res.json({ success: false, message: 'Server error' }, 500, corsHeaders());
  }
};
