import { and, eq, ilike, isNull } from 'drizzle-orm';
import { db, list, listMember, task } from '@todolist/db';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

export const searchRouter = router({
  query: protectedProcedure
    .input(z.object({ q: z.string().trim().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const pattern = `%${input.q}%`;
      const tasks = await db
        .select({
          id: task.id,
          title: task.title,
          listId: task.listId,
          listEmoji: list.emojiIcon,
          completed: task.completedAt,
        })
        .from(task)
        .innerJoin(list, eq(list.id, task.listId))
        .innerJoin(listMember, eq(listMember.listId, list.id))
        .where(
          and(eq(listMember.userId, ctx.user.id), isNull(task.deletedAt), ilike(task.title, pattern)),
        )
        .limit(20);

      const lists = await db
        .select({ id: list.id, name: list.name, emojiIcon: list.emojiIcon })
        .from(list)
        .innerJoin(listMember, eq(listMember.listId, list.id))
        .where(
          and(eq(listMember.userId, ctx.user.id), isNull(list.deletedAt), ilike(list.name, pattern)),
        )
        .limit(10);

      return { tasks, lists };
    }),
});
