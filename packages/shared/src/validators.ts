import { z } from 'zod';
import {
  APPEARANCES,
  DENSITIES,
  LIST_TYPES,
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
  type: z.enum(LIST_TYPES).default('tasks'),
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const updateListSchema = z.object({
  listId: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  emojiIcon: emojiSchema.optional(),
  color: hexColorSchema.nullable().optional(),
  type: z.enum(LIST_TYPES).optional(),
});

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
  // User IDs come from Better Auth and are NOT uuids.
  assigneeId: z.string().min(1).optional(),
  recurrenceRule: recurrenceSchema.optional(),
  tagIds: z.array(z.string().uuid()).max(20).optional(),
  // Groups an item under another, e.g. an ingredient under its meal on a
  // shopping list.
  parentTaskId: z.string().uuid().optional(),
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
    assigneeId: z.string().min(1).nullable().optional(),
    recurrenceRule: recurrenceSchema.nullable().optional(),
    // Null promotes a checklist item back to a heading of its own.
    parentTaskId: z.string().uuid().nullable().optional(),
  });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const acceptInviteSchema = z.object({ token: z.string().min(1) });

// ─────────────────────────── calendar ───────────────────────────
export const calendarRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const createEventSchema = z.object({
  listId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  notes: z.string().max(5000).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  assigneeId: z.string().min(1).optional(),
  // A weekly swimming lesson is an event, not a task — nobody completes it, so
  // it cannot use the task model where finishing one spawns the next.
  recurrenceRule: recurrenceSchema.optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema
  .partial()
  .omit({ listId: true })
  .extend({
    id: z.string().uuid(),
    // Moving an event to another list is allowed; access to the target is checked server-side.
    listId: z.string().uuid().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    recurrenceRule: recurrenceSchema.nullable().optional(),
  });

export const createBirthdaySchema = z.object({
  // No listId — birthdays go to the user's app-managed Birthdays list automatically.
  name: z.string().trim().min(1).max(120),
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1900).max(2100).optional(),
  linkedUserId: z.string().min(1).optional(),
});
export type CreateBirthdayInput = z.infer<typeof createBirthdaySchema>;

export const createReminderSchema = z.object({
  taskId: z.string().uuid(),
  sendAt: z.string().datetime(),
  channel: z.enum(REMINDER_CHANNELS).default('email'),
});

export const quickAddReminderSchema = z.object({
  // No listId — items go to the user's app-managed Reminders list automatically.
  title: z.string().trim().min(1).max(500),
  remindAt: z.string().datetime(),
});
export type QuickAddReminderInput = z.infer<typeof quickAddReminderSchema>;

// ─────────────────────────── meal planner ───────────────────────────

// A calendar day, "YYYY-MM-DD". Dinners are planned per date, not per timestamp,
// so there is no timezone to get wrong.
export const planDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const MEAL_NAME_MAX = 120;
export const COOK_SPAN_MAX = 7;

export const createMealSchema = z.object({
  planId: z.string().uuid(),
  name: z.string().trim().min(1).max(MEAL_NAME_MAX),
  // Stored as given; the API rejects anything that isn't http(s).
  recipeUrl: z.string().trim().url().max(2048).optional(),
  notes: z.string().max(10_000).optional(),
  // One ingredient per line; each becomes a shopping-list item under this meal.
  ingredients: z.string().max(10_000).optional(),
  isFavourite: z.boolean().optional(),
});
export type CreateMealInput = z.infer<typeof createMealSchema>;

export const updateMealSchema = createMealSchema
  .partial()
  .omit({ planId: true })
  .extend({
    id: z.string().uuid(),
    // Nullable so the UI can clear these fields.
    recipeUrl: z.string().trim().url().max(2048).nullable().optional(),
    notes: z.string().max(10_000).nullable().optional(),
    ingredients: z.string().max(10_000).nullable().optional(),
  });
export type UpdateMealInput = z.infer<typeof updateMealSchema>;

export const setMealDaySchema = z
  .object({
    planId: z.string().uuid(),
    date: planDateSchema,
    // Either pick an existing meal, or name a new one and it joins the catalog.
    mealId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(MEAL_NAME_MAX).optional(),
    // Nights this cook feeds, including the day itself. 1 = no leftovers.
    cookSpan: z.number().int().min(1).max(COOK_SPAN_MAX).default(1),
  })
  .refine((v) => Boolean(v.mealId) !== Boolean(v.name), {
    message: 'Provide exactly one of mealId or name',
  });
export type SetMealDayInput = z.infer<typeof setMealDaySchema>;

export const moveMealDaySchema = z.object({
  planId: z.string().uuid(),
  from: planDateSchema,
  to: planDateSchema,
});

export const mealPlanRangeSchema = z.object({
  planId: z.string().uuid(),
  from: planDateSchema,
  to: planDateSchema,
});

export const inviteToMealPlanSchema = z.object({
  planId: z.string().uuid(),
  email: emailSchema,
});

export const sendToShoppingListSchema = z.object({
  planId: z.string().uuid(),
  from: planDateSchema,
  to: planDateSchema,
});

/**
 * Fill a week from the one before it. `from`/`to` bound the week being filled;
 * the source week is the seven days immediately preceding `from`.
 */
export const copyWeekSchema = z.object({
  planId: z.string().uuid(),
  from: planDateSchema,
  to: planDateSchema,
});

export const requestMagicLinkSchema = z.object({
  email: emailSchema,
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

// ─────────────────────────── kids ───────────────────────────

/** Date.getDay() numbering: 0 = Sunday … 6 = Saturday. */
export const weekdaySchema = z.number().int().min(0).max(6);

/** "HH:MM", 24-hour. Times are local to the family; no timezone is stored. */
export const timeOfDaySchema = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Must be HH:MM');

export const createChildSchema = z.object({
  name: z.string().trim().min(1).max(120),
  emojiIcon: emojiSchema,
  color: hexColorSchema.optional(),
});
export type CreateChildInput = z.infer<typeof createChildSchema>;

/**
 * The whole week in one call.
 *
 * A weekly pattern is edited as a unit — you decide Bobby does Tuesdays and
 * Thursdays, not that Tuesday changed — and replacing the set avoids a
 * half-applied week if one row of several fails.
 */
export const setChildDaysSchema = z.object({
  listId: z.string().uuid(),
  days: z
    .array(
      z.object({
        weekday: weekdaySchema,
        place: z.string().trim().min(1).max(120),
        startTime: timeOfDaySchema.nullable().optional(),
        endTime: timeOfDaySchema.nullable().optional(),
      }),
    )
    .max(7),
});

export const upsertSchoolPeriodSchema = z
  .object({
    id: z.string().uuid().optional(),
    listId: z.string().uuid(),
    kind: z.enum(['term', 'break', 'closure']),
    name: z.string().trim().min(1).max(120),
    startDate: planDateSchema,
    endDate: planDateSchema,
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  });

export const updateChildProfileSchema = z.object({
  listId: z.string().uuid(),
  className: z.string().trim().max(120).nullable().optional(),
  room: z.string().trim().max(120).nullable().optional(),
  teacher: z.string().trim().max(120).nullable().optional(),
  officePhone: z.string().trim().max(40).nullable().optional(),
  medicalNotes: z.string().max(5000).nullable().optional(),
});
