import { router } from './trpc.js';
import { birthdaysRouter } from './routers/birthdays.js';
import { calendarRouter } from './routers/calendar.js';
import { eventsRouter } from './routers/events.js';
import { invitesRouter } from './routers/invites.js';
import { listsRouter } from './routers/lists.js';
import { prefsRouter } from './routers/prefs.js';
import { remindersRouter } from './routers/reminders.js';
import { searchRouter } from './routers/search.js';
import { tasksRouter } from './routers/tasks.js';

export const appRouter = router({
  prefs: prefsRouter,
  lists: listsRouter,
  tasks: tasksRouter,
  reminders: remindersRouter,
  invites: invitesRouter,
  search: searchRouter,
  calendar: calendarRouter,
  events: eventsRouter,
  birthdays: birthdaysRouter,
});

export type AppRouter = typeof appRouter;
