import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * NOTE ON AUTH TABLES
 * -------------------
 * `user`, `session`, `account`, and `verification` follow Better Auth's expected
 * shape (Better Auth stores magic-link tokens in `verification`). After changing
 * these, run `pnpm --filter @todolist/api auth:generate` (the Better Auth CLI) to
 * confirm the schema still matches what the library expects.
 */

// ─────────────────────────── enums ───────────────────────────
export const themeEnum = pgEnum('theme', ['tento', 'nudge', 'momentum']);
export const appearanceEnum = pgEnum('appearance', ['system', 'light', 'dark']);
export const densityEnum = pgEnum('density', ['comfortable', 'cozy', 'compact']);
export const priorityEnum = pgEnum('priority', ['none', 'low', 'medium', 'high']);
export const listRoleEnum = pgEnum('list_role', ['owner', 'member']);
export const listTypeEnum = pgEnum('list_type', ['tasks', 'checklist', 'child', 'note']);
/** A term is in session; a break is not; a closure is a single day off inside a term. */
export const schoolPeriodKindEnum = pgEnum('school_period_kind', ['term', 'break', 'closure']);
export const inviteStatusEnum = pgEnum('invite_status', [
  'pending',
  'accepted',
  'declined',
  'revoked',
]);
export const reminderChannelEnum = pgEnum('reminder_channel', ['email', 'push', 'in_app']);
/** An adult signs in; a child is someone the family keeps track of. */
export const personKindEnum = pgEnum('person_kind', ['adult', 'child']);
export const calendarViewEnum = pgEnum('calendar_view', ['month', 'week', 'agenda', 'list']);

// ─────────────────────────── auth ───────────────────────────
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  // App-specific identity used across shared lists / assignees.
  avatarEmoji: text('avatar_emoji').notNull().default('🙂'),
  avatarColor: text('avatar_color').notNull().default('#8B5CF6'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────── household ───────────────────────────
/**
 * The family. Everyone joins once; lists and the meal plan are shared with the
 * whole household unless a list is marked private. Membership on a list is
 * still recorded row by row in list_member — the household is what decides
 * which rows get written, so every existing access check keeps working.
 */
export const household = pgTable('household', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().default('Family'),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  // The Monday that starts a "week A" for anyone on a fortnightly work
  // pattern. Any Monday will do; swapping A and B just moves it a week.
  fortnightAnchor: date('fortnight_anchor', { mode: 'string' }).notNull().default('2026-01-05'),
  // Lets a wall display fetch the household's day without a sign-in. Rotate
  // it from Family if a link gets out.
  wallToken: text('wall_token').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// ─────────────────────────── preferences ───────────────────────────
export const userPrefs = pgTable('user_prefs', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  theme: themeEnum('theme').notNull().default('nudge'),
  appearance: appearanceEnum('appearance').notNull().default('system'),
  density: densityEnum('density').notNull().default('cozy'),
  textScale: doublePrecision('text_scale').notNull().default(0.96),
  calendarView: calendarViewEnum('calendar_view').notNull().default('month'),
  notifyEmail: boolean('notify_email').notNull().default(true),
  notifyPush: boolean('notify_push').notNull().default(true),
  // Not everyone plans meals. Hiding the tab is a preference, not a deletion —
  // the plan and its data stay exactly where they were.
  showMeals: boolean('show_meals').notNull().default(true),
  showKids: boolean('show_kids').notNull().default(true),
  // 1 = Monday, 0 = Sunday, matching Date.getDay(). Applies to the meal week and
  // the calendar alike; two different first-days in one app would be worse than
  // either choice.
  weekStartsOn: smallint('week_starts_on').notNull().default(1),
  // When this person last looked at what the family has been doing. Anything
  // newer, done by someone else, is "new" on Today.
  activitySeenAt: timestamp('activity_seen_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────── lists ───────────────────────────
export const list = pgTable(
  'list',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    emojiIcon: text('emoji_icon').notNull().default('📝'),
    color: text('color'),
    type: listTypeEnum('type').notNull().default('tasks'),
    // Marks an app-managed list (e.g. 'birthdays'); hidden from the normal Lists view.
    systemKey: text('system_key'),
    // Whose household the list belongs to. Null only for rows older than the
    // household model whose owner has since gone.
    householdId: uuid('household_id').references(() => household.id, { onDelete: 'set null' }),
    // A private list is shared only with the people explicitly added to it;
    // otherwise every adult in the household is a member automatically.
    private: boolean('private').notNull().default(false),
    // Lets someone tuck a built-in list away without deleting it. Only ever set
    // on system lists, which each user owns their own copy of — so it is
    // effectively per-user. Ordinary lists are shared, where a single flag would
    // hide the list for everyone.
    hidden: boolean('hidden').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('list_owner_idx').on(t.ownerId),
    // One system list of each kind per user. The get-or-create helpers filter on
    // `deletedAt`, so without this a deleted system list would be silently
    // replaced by a duplicate and its tasks orphaned. Postgres treats NULLs as
    // distinct, so ordinary lists are unaffected.
    uniqueIndex('list_owner_system_idx').on(t.ownerId, t.systemKey),
  ],
);

/**
 * The body of a note list: one free-text document per list of type 'note'.
 *
 * Kept out of `list` so the summary query every screen loads doesn't drag the
 * text of every note along with it. Last write wins between members — a family
 * sharing a holiday plan, not a document editor.
 */
export const listNote = pgTable('list_note', {
  listId: uuid('list_id')
    .primaryKey()
    .references(() => list.id, { onDelete: 'cascade' }),
  body: text('body').notNull().default(''),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Someone in the household. Adults link to a login through userId; children
 * don't have one (yet), which is exactly why they need a row of their own: a
 * task or an event can be theirs without them ever signing in.
 *
 * An adult's name and avatar are copied from their account and kept in step by
 * the account router, so every screen that shows a person reads one table.
 */
export const person = pgTable(
  'person',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    kind: personKindEnum('kind').notNull().default('adult'),
    name: text('name').notNull(),
    avatarEmoji: text('avatar_emoji').notNull().default('🙂'),
    avatarColor: text('avatar_color').notNull().default('#8B5CF6'),
    image: text('image'),
    // A child's list: their week, term dates and profile. Null for adults.
    childListId: uuid('child_list_id').references(() => list.id, { onDelete: 'set null' }),
    // "WFH Fridays", "on call every third weekend": the bit a grid can't say.
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('person_household_idx').on(t.householdId),
    uniqueIndex('person_user_idx').on(t.userId),
  ],
);

/**
 * Where an adult is on each weekday: work, mostly. One row per working day
 * over a fortnight, so a nine-day fortnight or alternating days both fit.
 * Week 0 is the week starting on the household's fortnightAnchor.
 */
export const personWorkday = pgTable(
  'person_workday',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    week: smallint('week').notNull().default(0),
    // Date.getDay() numbering: 0 = Sunday.
    weekday: smallint('weekday').notNull(),
    place: text('place').notNull().default('Work'),
    startTime: text('start_time'),
    endTime: text('end_time'),
  },
  (t) => [uniqueIndex('person_workday_idx').on(t.personId, t.week, t.weekday)],
);

export const householdInvite = pgTable(
  'household_invite',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: inviteStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('household_invite_household_idx').on(t.householdId),
    index('household_invite_email_idx').on(t.email),
  ],
);

/**
 * What people in the household have done: a task ticked, a dinner planned, a
 * child added. Written by the routers at the moment of change, read as a feed.
 * Rows on a list are only shown to that list's members, so a private list's
 * comings and goings stay private.
 */
export const activity = pgTable(
  'activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => person.id, { onDelete: 'set null' }),
    // e.g. 'task.completed', 'event.created', 'meal.planned', 'child.added'
    kind: text('kind').notNull(),
    listId: uuid('list_id').references(() => list.id, { onDelete: 'cascade' }),
    // The task/event/person the row is about, if any. Not a foreign key: the
    // row should outlive what it describes.
    targetId: uuid('target_id'),
    // What to show: a title, and a small JSON bag of extras (date, assignee…).
    title: text('title').notNull(),
    meta: text('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activity_household_created_idx').on(t.householdId, t.createdAt)],
);

export const listMember = pgTable(
  'list_member',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: listRoleEnum('role').notNull().default('member'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.listId, t.userId] }),
    index('list_member_user_idx').on(t.userId),
  ],
);

export const listInvite = pgTable(
  'list_invite',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: inviteStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('list_invite_list_idx').on(t.listId), index('list_invite_email_idx').on(t.email)],
);

// ─────────────────────────── tasks ───────────────────────────
export const task = pgTable(
  'task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    priority: priorityEnum('priority').notNull().default('none'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // A person, not an account: a child can own a task without a login.
    assigneeId: uuid('assignee_id').references(() => person.id, { onDelete: 'set null' }),
    // iCal RRULE, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
    recurrenceRule: text('recurrence_rule'),
    // For subtasks / recurrence instances.
    parentTaskId: uuid('parent_task_id'),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('task_list_idx').on(t.listId),
    index('task_assignee_idx').on(t.assigneeId),
    index('task_due_idx').on(t.dueAt),
    index('task_parent_idx').on(t.parentTaskId),
  ],
);

export const tag = pgTable(
  'tag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tag_list_name_idx').on(t.listId, t.name)],
);

export const taskTag = pgTable(
  'task_tag',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] })],
);

// ─────────────────────────── calendar: events & birthdays ───────────────────────────
export const event = pgTable(
  'event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    // An RRULE string, e.g. "FREQ=WEEKLY;BYDAY=TH". Unlike a recurring task —
    // which spawns its next instance when you complete it — a recurring event
    // is never completed, so occurrences are expanded when a date range is read
    // rather than materialised as rows.
    recurrenceRule: text('recurrence_rule'),
    // Whose event it is (drives the per-person colour on the calendar). A
    // person, so a child's swimming lesson is theirs.
    assigneeId: uuid('assignee_id').references(() => person.id, { onDelete: 'set null' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('event_list_idx').on(t.listId), index('event_start_idx').on(t.startAt)],
);

export const birthday = pgTable(
  'birthday',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    day: integer('day').notNull(), // 1–31
    month: integer('month').notNull(), // 1–12
    year: integer('year'), // optional birth year, for showing age
    // Optional link to an app user (e.g. a family member's account).
    linkedUserId: text('linked_user_id').references(() => user.id, { onDelete: 'set null' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('birthday_list_idx').on(t.listId)],
);

// ─────────────────────────── reminders & notifications ───────────────────────────
export const reminder = pgTable(
  'reminder',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sendAt: timestamp('send_at', { withTimezone: true }).notNull(),
    channel: reminderChannelEnum('channel').notNull().default('email'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reminder_send_idx').on(t.sendAt), index('reminder_task_idx').on(t.taskId)],
);

export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('push_sub_user_idx').on(t.userId)],
);

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: text('payload'), // JSON-encoded event data
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notification_user_idx').on(t.userId)],
);

// ─────────────────────────── meal planner ───────────────────────────
/**
 * A meal plan is a shareable object in its own right, mirroring `list` —
 * same ownership, membership and invite-by-email shape, so a household shares a
 * plan the same way it shares a list. `listRoleEnum` and `inviteStatusEnum` are
 * reused rather than duplicated; both are generic owner/member and invite
 * lifecycle concepts, not list-specific ones.
 */
export const mealPlan = pgTable(
  'meal_plan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Meals'),
    emojiIcon: text('emoji_icon').notNull().default('🍽️'),
    householdId: uuid('household_id').references(() => household.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('meal_plan_owner_idx').on(t.ownerId)],
);

export const mealPlanMember = pgTable(
  'meal_plan_member',
  {
    planId: uuid('plan_id')
      .notNull()
      .references(() => mealPlan.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: listRoleEnum('role').notNull().default('member'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.planId, t.userId] }),
    index('meal_plan_member_user_idx').on(t.userId),
  ],
);

export const mealPlanInvite = pgTable(
  'meal_plan_invite',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => mealPlan.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: inviteStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('meal_plan_invite_plan_idx').on(t.planId),
    index('meal_plan_invite_email_idx').on(t.email),
  ],
);

/**
 * The meal catalog: one row per distinct meal in a plan. This is what powers
 * autocomplete, and what remembers a meal's recipe link between weeks.
 * Names are unique per plan; case-insensitive matching is done in application
 * code (trim + `ilike`) rather than an expression index, to keep migrations plain.
 */
export const meal = pgTable(
  'meal',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => mealPlan.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    recipeUrl: text('recipe_url'),
    notes: text('notes'),
    // One ingredient per line. Kept as text rather than its own table: they are
    // plain strings at this scale, and a textarea of lines is a far simpler
    // editor than a repeating row form. Each line becomes a shopping-list child.
    ingredients: text('ingredients'),
    isFavourite: boolean('is_favourite').notNull().default(false),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('meal_plan_idx').on(t.planId),
    uniqueIndex('meal_plan_name_idx').on(t.planId, t.name),
  ],
);

/**
 * One planned dinner per calendar day. `mealId` is a real foreign key, so
 * renaming a meal updates every week it appears in — the plan can never drift
 * from the catalog the way free-text meal names did.
 *
 * Leftovers are DERIVED, never stored: `cookSpan` on the cook's row claims the
 * following `cookSpan - 1` days. Nothing points back at the cook, so moving a
 * cook moves its whole chain and shortening the span clears the tail, both for
 * free. Writing a meal onto a claimed day truncates the earlier cook's span.
 *
 * No `deletedAt` here: this is an upserted cell rather than a user-visible
 * entity, and a soft-deleted row would collide with the (plan, date) unique
 * index. Clearing a day deletes the row, as `reminder` and `tag` do.
 */
export const mealPlanDay = pgTable(
  'meal_plan_day',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => mealPlan.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    mealId: uuid('meal_id')
      .notNull()
      .references(() => meal.id, { onDelete: 'cascade' }),
    // Nights this cook feeds, including the day itself. 1 = no leftovers.
    cookSpan: integer('cook_span').notNull().default(1),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('meal_plan_day_plan_idx').on(t.planId),
    uniqueIndex('meal_plan_day_plan_date_idx').on(t.planId, t.date),
  ],
);

/**
 * A child is a list of type 'child', so it already has a name, an icon, members
 * and the ability to hold tasks and events. These three tables add only what a
 * list cannot express.
 */

/** Where a child is on each weekday. One row per day they go somewhere. */
export const childDay = pgTable(
  'child_day',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    // Date.getDay() numbering: 0 = Sunday. Stored raw so it needs no
    // translation when compared against a real date.
    weekday: smallint('weekday').notNull(),
    place: text('place').notNull(),
    // "HH:MM", local to the family. A day with no times is still a valid day.
    startTime: text('start_time'),
    endTime: text('end_time'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('child_day_list_weekday_idx').on(t.listId, t.weekday)],
);

/**
 * Term dates, holidays and pupil-free days.
 *
 * Without these the weekly pattern says "school" on the first Monday of the
 * holidays, and stops being worth trusting. A closure is a one-day range, so
 * all three kinds share a shape.
 */
export const schoolPeriod = pgTable(
  'school_period',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    kind: schoolPeriodKindEnum('kind').notNull(),
    name: text('name').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('school_period_list_idx').on(t.listId)],
);

/** The details you otherwise hunt for in an email. One row per child. */
export const childProfile = pgTable('child_profile', {
  listId: uuid('list_id')
    .primaryKey()
    .references(() => list.id, { onDelete: 'cascade' }),
  className: text('class_name'),
  room: text('room'),
  teacher: text('teacher'),
  officePhone: text('office_phone'),
  // Allergies, medication, anything a carer would need in a hurry.
  medicalNotes: text('medical_notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────── relations ───────────────────────────
export const userRelations = relations(user, ({ many, one }) => ({
  prefs: one(userPrefs, { fields: [user.id], references: [userPrefs.userId] }),
  ownedLists: many(list),
  memberships: many(listMember),
}));

export const listRelations = relations(list, ({ many, one }) => ({
  owner: one(user, { fields: [list.ownerId], references: [user.id] }),
  members: many(listMember),
  tasks: many(task),
  tags: many(tag),
}));

export const listMemberRelations = relations(listMember, ({ one }) => ({
  list: one(list, { fields: [listMember.listId], references: [list.id] }),
  user: one(user, { fields: [listMember.userId], references: [user.id] }),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
  list: one(list, { fields: [task.listId], references: [list.id] }),
  assignee: one(person, { fields: [task.assigneeId], references: [person.id] }),
  tags: many(taskTag),
  reminders: many(reminder),
}));

export const taskTagRelations = relations(taskTag, ({ one }) => ({
  task: one(task, { fields: [taskTag.taskId], references: [task.id] }),
  tag: one(tag, { fields: [taskTag.tagId], references: [tag.id] }),
}));
