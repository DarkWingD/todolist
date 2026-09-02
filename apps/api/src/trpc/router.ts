import { router } from './trpc.js';
import { accountRouter } from './routers/account.js';
import { birthdaysRouter } from './routers/birthdays.js';
import { calendarRouter } from './routers/calendar.js';
import { eventsRouter } from './routers/events.js';
import { invitesRouter } from './routers/invites.js';
import { listsRouter } from './routers/lists.js';
import { mealPlanRouter } from './routers/mealPlan.js';
import { prefsRouter } from './routers/prefs.js';
import { pushRouter } from './routers/push.js';
import { remindersRouter } from './routers/reminders.js';
import { searchRouter } from './routers/search.js';
import { tasksRouter } from './routers/tasks.js';

export const appRouter = router({
  prefs: prefsRouter,
  lists: listsRouter,
  mealPlan: mealPlanRouter,
  tasks: tasksRouter,
  reminders: remindersRouter,
  invites: invitesRouter,
  search: searchRouter,
  calendar: calendarRouter,
  events: eventsRouter,
  birthdays: birthdaysRouter,
  account: accountRouter,
  push: pushRouter,
});

export type AppRouter = typeof appRouter;
