const { env } = require('../src/config/env');

// The old SQLite DATABASE_PATH setting does not isolate a MySQL database.
const name = env.databaseUrl ? new URL(env.databaseUrl).pathname.slice(1) : env.dbName;
if (env.nodeEnv !== 'test' || !/^lab_booking_test_[a-f0-9]{16}$/.test(name)) {
  throw new Error('Run tests through runIsolated.cjs; a disposable MySQL test database is required.');
}
