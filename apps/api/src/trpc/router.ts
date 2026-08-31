import { router } from './trpc.js';
import { listsRouter } from './routers/lists.js';
import { prefsRouter } from './routers/prefs.js';
import { tasksRouter } from './routers/tasks.js';

export const appRouter = router({
  prefs: prefsRouter,
  lists: listsRouter,
  tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;
