const crypto = require('crypto');
const { getPool } = require('../config/db');

function createId() {
  return crypto.randomBytes(12).toString('hex');
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `\`${value}\``;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function hydrateRow(row, jsonFields, booleanFields, aliases) {
  if (!row) return null;
  const result = { ...row };
  for (const field of jsonFields) result[field] = parseJson(result[field], field === 'metadata' ? {} : []);
  for (const field of booleanFields) result[field] = Boolean(result[field]);
  for (const [stored, exposed] of Object.entries(aliases)) {
    if (Object.prototype.hasOwnProperty.call(result, stored)) {
      result[exposed] = result[stored];
      delete result[stored];
    }
  }
  return result;
}

function serializeValue(field, value, jsonFields, booleanFields, aliases) {
  const storedField = Object.entries(aliases).find(([, exposed]) => exposed === field)?.[0] || field;
  if (jsonFields.includes(storedField)) return [storedField, JSON.stringify(value ?? (storedField === 'metadata' ? {} : []))];
  if (booleanFields.includes(storedField)) return [storedField, value ? 1 : 0];
  return [storedField, value];
}

function buildFieldCondition(field, value, params) {
  const q = quoteIdentifier(field);
  if (value === null) return `${q} IS NULL`;
  if (value === undefined) return '1=1';
  if (typeof value !== 'object' || value instanceof Date || Array.isArray(value)) {
    params.push(value);
    return `${q} = ?`;
  }

  const clauses = [];
  for (const [operator, operand] of Object.entries(value)) {
    if (operator === '$in') {
      if (!operand.length) { clauses.push('0=1'); continue; }
      params.push(...operand);
      clauses.push(`${q} IN (${operand.map(() => '?').join(', ')})`);
    } else if (operator === '$nin') {
      if (!operand.length) continue;
      params.push(...operand);
      clauses.push(`${q} NOT IN (${operand.map(() => '?').join(', ')})`);
    } else if (operator === '$ne') {
      if (operand === null) clauses.push(`${q} IS NOT NULL`);
      else { params.push(operand); clauses.push(`${q} <> ?`); }
    } else if (operator === '$lt' || operator === '$lte' || operator === '$gt' || operator === '$gte') {
      const sqlOperator = { $lt: '<', $lte: '<=', $gt: '>', $gte: '>=' }[operator];
      params.push(operand);
      clauses.push(`${q} ${sqlOperator} ?`);
    } else if (operator === '$regex') {
      const raw = operand instanceof RegExp ? operand.source : String(operand);
      params.push(`%${raw.replace(/[.*+?^${}()|[\]\\]/g, '')}%`);
      clauses.push(`${q} LIKE ?`);
    }
  }
  return clauses.length ? `(${clauses.join(' AND ')})` : '1=1';
}

function buildWhere(where = {}, aliases = {}) {
  const params = [];
  const parts = [];
  for (const [field, value] of Object.entries(where)) {
    if (field === '$or') {
      const subParts = value.map((entry) => {
        const built = buildWhere(entry, aliases);
        params.push(...built.params);
        return `(${built.sql})`;
      });
      parts.push(subParts.length ? `(${subParts.join(' OR ')})` : '0=1');
      continue;
    }
    if (field === '$and') {
      const subParts = value.map((entry) => {
        const built = buildWhere(entry, aliases);
        params.push(...built.params);
        return `(${built.sql})`;
      });
      parts.push(subParts.length ? `(${subParts.join(' AND ')})` : '1=1');
      continue;
    }
    const storedField = Object.entries(aliases).find(([, exposed]) => exposed === field)?.[0] || field;
    parts.push(buildFieldCondition(storedField, value, params));
  }
  return { sql: parts.length ? parts.join(' AND ') : '1=1', params };
}

function createRepository({ table, jsonFields = [], booleanFields = [], aliases = {}, defaults = {} }) {
  const tableName = quoteIdentifier(table);

  async function create(data) {
    const now = new Date();
    const resolvedDefaults = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, typeof value === 'function' ? value() : value]));
    const input = { ...resolvedDefaults, ...data, _id: data._id || createId(), createdAt: data.createdAt || now, updatedAt: data.updatedAt || now };
    const entries = Object.entries(input).map(([field, value]) => serializeValue(field, value, jsonFields, booleanFields, aliases));
    const fields = entries.map(([field]) => quoteIdentifier(field));
    const values = entries.map(([, value]) => value);
    await getPool().execute(`INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, values);
    return findById(input._id);
  }

  async function insertMany(rows) {
    const results = [];
    for (const row of rows) results.push(await create(row));
    return results;
  }

  async function findAll(where = {}, options = {}) {
    const built = buildWhere(where, aliases);
    let sql = `SELECT * FROM ${tableName} WHERE ${built.sql}`;
    if (options.orderBy?.length) {
      const order = options.orderBy.map(([field, direction = 'ASC']) => {
        const storedField = Object.entries(aliases).find(([, exposed]) => exposed === field)?.[0] || field;
        return `${quoteIdentifier(storedField)} ${String(direction).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
      });
      sql += ` ORDER BY ${order.join(', ')}`;
    }
    if (options.limit) sql += ` LIMIT ${Math.max(1, Number(options.limit))}`;
    const [rows] = await getPool().execute(sql, built.params);
    return rows.map((row) => hydrateRow(row, jsonFields, booleanFields, aliases));
  }

  async function findOne(where = {}, options = {}) {
    const rows = await findAll(where, { ...options, limit: 1 });
    return rows[0] || null;
  }

  async function findById(id) {
    if (!id) return null;
    return findOne({ _id: id });
  }

  async function updateById(id, updates) {
    if (!id) return null;
    const clean = { ...updates, updatedAt: new Date() };
    delete clean._id;
    delete clean.createdAt;
    const entries = Object.entries(clean)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => serializeValue(field, value, jsonFields, booleanFields, aliases));
    if (!entries.length) return findById(id);
    const values = entries.map(([, value]) => value);
    values.push(id);
    const [result] = await getPool().execute(`UPDATE ${tableName} SET ${entries.map(([field]) => `${quoteIdentifier(field)} = ?`).join(', ')} WHERE _id = ?`, values);
    return result.affectedRows ? findById(id) : null;
  }

  async function updateWhere(where, updates) {
    const clean = { ...updates, updatedAt: new Date() };
    delete clean._id;
    delete clean.createdAt;
    const entries = Object.entries(clean)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => serializeValue(field, value, jsonFields, booleanFields, aliases));
    if (!entries.length) return { affectedRows: 0 };
    const built = buildWhere(where, aliases);
    const params = [...entries.map(([, value]) => value), ...built.params];
    const [result] = await getPool().execute(`UPDATE ${tableName} SET ${entries.map(([field]) => `${quoteIdentifier(field)} = ?`).join(', ')} WHERE ${built.sql}`, params);
    return result;
  }

  async function deleteById(id) {
    const existing = await findById(id);
    if (!existing) return null;
    await getPool().execute(`DELETE FROM ${tableName} WHERE _id = ?`, [id]);
    return existing;
  }

  async function deleteWhere(where = {}) {
    const built = buildWhere(where, aliases);
    const [result] = await getPool().execute(`DELETE FROM ${tableName} WHERE ${built.sql}`, built.params);
    return result;
  }

  async function count(where = {}) {
    const built = buildWhere(where, aliases);
    const [rows] = await getPool().execute(`SELECT COUNT(*) AS count FROM ${tableName} WHERE ${built.sql}`, built.params);
    return Number(rows[0]?.count || 0);
  }

  async function exists(where = {}) {
    return Boolean(await findOne(where));
  }

  return { table, create, insertMany, findAll, findOne, findById, updateById, updateWhere, deleteById, deleteWhere, count, exists };
}

module.exports = { createRepository, createId };
