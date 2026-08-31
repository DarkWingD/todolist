import PgBoss from 'pg-boss';
import { env } from './env.js';
import { materializeRecurring } from './recurring.js';
import { sendDueReminders } from './reminders.js';

async function main() {
  const boss = new PgBoss(env.DATABASE_URL);
  boss.on('error', (err) => console.error('pg-boss error:', err));
  await boss.start();

  await boss.createQueue('reminder-tick');
  await boss.createQueue('recurrence-tick');

  await boss.work('reminder-tick', async () => {
    await sendDueReminders();
  });
  await boss.work('recurrence-tick', async () => {
    await materializeRecurring();
  });

  // Cron schedules (pg-boss stores these; safe to call on every boot).
  await boss.schedule('reminder-tick', '* * * * *'); // every minute
  await boss.schedule('recurrence-tick', '*/15 * * * *'); // every 15 minutes

  console.log('👷 Worker started — reminders every 1m, recurrence every 15m.');
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
