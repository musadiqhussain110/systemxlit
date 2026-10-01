const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { env } = require('./env');
const { schemaStatements, tablesInDependencyOrder } = require('./schema');

let database = null;
let adapter = null;

function normalizeParameter(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}

function isReadQuery(sql) {
  return /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(sql);
}

function createAdapter(db) {
  return {
    async execute(sql, params = []) {
      const statement = db.prepare(sql);
      const values = params.map(normalizeParameter);
      if (isReadQuery(sql)) return [statement.all(...values), []];

      const result = statement.run(...values);
      return [{
        affectedRows: Number(result.changes || 0),
        insertId: result.lastInsertRowid == null ? 0 : Number(result.lastInsertRowid),
      }, []];
    },

    async query(sql, params = []) {
      return this.execute(sql, params);
    },
  };
}

function resolveDatabasePath() {
  if (env.databasePath === ':memory:') return ':memory:';
  return path.isAbsolute(env.databasePath)
    ? env.databasePath
    : path.resolve(__dirname, '../..', env.databasePath);
}

function getDatabase() {
  if (!database) throw new Error('Database has not been connected yet');
  return database;
}

function getPool() {
  if (!adapter) throw new Error('Database has not been connected yet');
  return adapter;
}

function ensureColumn(table, column, definition) {
  const db = getDatabase();
  const columns = db.prepare(`PRAGMA table_info(\`${table}\`)`).all();
  if (!columns.some((entry) => entry.name === column)) db.exec(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

function createSchema() {
  const db = getDatabase();
  for (const statement of schemaStatements) db.exec(statement);
  ensureColumn('equipment', 'approvalRequired', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('booking_rules', 'departmentOnlyAccess', 'INTEGER NOT NULL DEFAULT 0');
}

async function connectDatabase() {
  if (database) return adapter;

  const databasePath = resolveDatabasePath();
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  database = new DatabaseSync(databasePath);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA synchronous = NORMAL');
  database.exec('PRAGMA busy_timeout = 5000');
  createSchema();
  adapter = createAdapter(database);

  console.log(`SQLite connected: ${databasePath}`);
  return adapter;
}

async function resetDatabase() {
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const table of tablesInDependencyOrder) db.exec(`DROP TABLE IF EXISTS \`${table}\``);
    createSchema();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function closeDatabase() {
  if (!database) return;
  database.close();
  database = null;
  adapter = null;
}

module.exports = { connectDatabase, getPool, getDatabase, resetDatabase, closeDatabase };
