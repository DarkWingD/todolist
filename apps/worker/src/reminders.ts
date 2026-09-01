import { and, eq, isNull, lte } from 'drizzle-orm';
import { db, pushSubscription, reminder, task, user } from '@todolist/db';
import { sendEmail } from './email.js';
import { env } from './env.js';
import { pushEnabled, sendPush } from './push.js';

/** Deliver due reminders (email + web push), then mark them sent. */
export async function sendDueReminders() {
  const now = new Date();
  const due = await db
    .select({
      reminderId: reminder.id,
      userId: reminder.userId,
      email: user.email,
      taskId: task.id,
      taskTitle: task.title,
    })
    .from(reminder)
    .innerJoin(task, eq(task.id, reminder.taskId))
    .innerJoin(user, eq(user.id, reminder.userId))
    .where(and(lte(reminder.sendAt, now), isNull(reminder.sentAt)));

  for (const r of due) {
    const url = `${env.WEB_ORIGIN}/task/${r.taskId}`;
    try {
      await sendEmail({
        to: r.email,
        subject: `⏰ Reminder: ${r.taskTitle}`,
        text: `Reminder for your task "${r.taskTitle}". Open it: ${url}`,
        html: `<p>Reminder for your task <strong>${r.taskTitle}</strong>.</p><p><a href="${url}">Open task</a></p>`,
      });
    } catch (err) {
      console.error(`Email reminder ${r.reminderId} failed:`, err);
    }

    // Web push to all of the user's devices.
    if (pushEnabled()) {
      const subs = await db
        .select()
        .from(pushSubscription)
        .where(eq(pushSubscription.userId, r.userId));
      for (const s of subs) {
        const res = await sendPush(s, { title: `⏰ ${r.taskTitle}`, body: 'Reminder', url });
        if (res === 'gone') {
          await db.delete(pushSubscription).where(eq(pushSubscription.id, s.id));
        }
      }
    }

    await db.update(reminder).set({ sentAt: new Date() }).where(eq(reminder.id, r.reminderId));
  }

  if (due.length) console.log(`Sent ${due.length} reminder(s).`);
}
