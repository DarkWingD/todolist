import { and, eq, isNull, lte } from 'drizzle-orm';
import { db, reminder, task, user } from '@todolist/db';
import { sendEmail } from './email.js';
import { env } from './env.js';

/** Send any email reminders whose time has arrived, then mark them sent. */
export async function sendDueReminders() {
  const now = new Date();
  const due = await db
    .select({
      reminderId: reminder.id,
      email: user.email,
      taskId: task.id,
      taskTitle: task.title,
    })
    .from(reminder)
    .innerJoin(task, eq(task.id, reminder.taskId))
    .innerJoin(user, eq(user.id, reminder.userId))
    .where(
      and(lte(reminder.sendAt, now), isNull(reminder.sentAt), eq(reminder.channel, 'email')),
    );

  for (const r of due) {
    try {
      const url = `${env.WEB_ORIGIN}/task/${r.taskId}`;
      await sendEmail({
        to: r.email,
        subject: `⏰ Reminder: ${r.taskTitle}`,
        text: `Reminder for your task "${r.taskTitle}". Open it: ${url}`,
        html: `<p>Reminder for your task <strong>${r.taskTitle}</strong>.</p><p><a href="${url}">Open task</a></p>`,
      });
      await db.update(reminder).set({ sentAt: new Date() }).where(eq(reminder.id, r.reminderId));
    } catch (err) {
      console.error(`Failed to send reminder ${r.reminderId}:`, err);
    }
  }

  if (due.length) console.log(`Sent ${due.length} reminder(s).`);
}
