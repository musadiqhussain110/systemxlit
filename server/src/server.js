const { app } = require('./app');
const { connectDatabase } = require('./config/db');
const { env } = require('./config/env');
const { startReminderJob } = require('./jobs/reminderJob');

async function start() {
  await connectDatabase();
  startReminderJob();
  app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
}

start().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
