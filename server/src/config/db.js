const mysql = require('mysql2/promise');
const { env } = require('./env');
const { schemaStatements, tablesInDependencyOrder } = require('./schema');

let pool = null;

function connectionOptions() {
  if (env.databaseUrl) {
    const url = new URL(env.databaseUrl);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, '') || 'default'),
      ssl: { rejectUnauthorized: env.dbSslRejectUnauthorized },
    };
  }

  return {
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    ...(env.dbSsl ? { ssl: { rejectUnauthorized: env.dbSslRejectUnauthorized } } : {}),
  };
}

function getPool() {
  if (!pool) throw new Error('Database has not been connected yet');
  return pool;
}

async function createSchema() {
  for (const statement of schemaStatements) await getPool().query(statement);
}

async function connectDatabase() {
  if (pool) return pool;
  pool = mysql.createPool({
    ...connectionOptions(),
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    connectTimeout: 12_000,
    decimalNumbers: true,
    dateStrings: true,
  });
  await pool.query('SELECT 1');
  await createSchema();
  console.log('MySQL connected');
  return pool;
}

async function resetDatabase() {
  const db = getPool();
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tablesInDependencyOrder) await db.query(`DROP TABLE IF EXISTS \`${table}\``);
  } finally {
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
  }
  await createSchema();
}

async function closeDatabase() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = { connectDatabase, getPool, resetDatabase, closeDatabase };
