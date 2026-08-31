import { z } from 'zod';
import {
  APPEARANCES,
  DENSITIES,
  PRIORITIES,
  REMINDER_CHANNELS,
  TEXT_SCALE,
  THEMES,
} from './constants.js';

export const emailSchema = z.string().trim().toLowerCase().email();

// A single emoji (rough guard — one grapheme, not ASCII). Good enough for list/user icons.
export const emojiSchema = z
  .string()
  .min(1)
  .max(8)
  .refine((s) => !/^[\x00-\x7F]*$/.test(s), 'Must be an emoji');

// #RRGGBB
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color');

export const userPrefsSchema = z.object({
  theme: z.enum(THEMES),
  appearance: z.enum(APPEARANCES),
  density: z.enum(DENSITIES),
  textScale: z.number().min(TEXT_SCALE.min).max(TEXT_SCALE.max),
});
export type UserPrefsInput = z.infer<typeof userPrefsSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  avatarEmoji: emojiSchema,
  avatarColor: hexColorSchema,
});

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(120),
  emojiIcon: emojiSchema,
  color: hexColorSchema.optional(),
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const inviteToListSchema = z.object({
  listId: z.string().uuid(),
  email: emailSchema,
});

// RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR". Validated more strictly server-side.
export const recurrenceSchema = z.string().max(300);

export const createTaskSchema = z.object({
  listId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10_000).optional(),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(PRIORITIES).default('none'),
  assigneeId: z.string().uuid().optional(),
  recurrenceRule: recurrenceSchema.optional(),
  tagIds: z.array(z.string().uuid()).max(20).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema
  .partial()
  .omit({ listId: true })
  .extend({
    id: z.string().uuid(),
    completed: z.boolean().optional(),
    // Nullable so the UI can clear these fields.
    dueAt: z.string().datetime().nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    recurrenceRule: recurrenceSchema.nullable().optional(),
  });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const acceptInviteSchema = z.object({ token: z.string().min(1) });

export const createReminderSchema = z.object({
  taskId: z.string().uuid(),
  sendAt: z.string().datetime(),
  channel: z.enum(REMINDER_CHANNELS).default('email'),
});

export const requestMagicLinkSchema = z.object({
  email: emailSchema,
});
