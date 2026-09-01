import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
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
export const listTypeEnum = pgEnum('list_type', ['tasks', 'checklist']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'declined', 'revoked']);
export const reminderChannelEnum = pgEnum('reminder_channel', ['email', 'push', 'in_app']);

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
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('list_owner_idx').on(t.ownerId)],
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
  (t) => [primaryKey({ columns: [t.listId, t.userId] }), index('list_member_user_idx').on(t.userId)],
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
    assigneeId: text('assignee_id').references(() => user.id, { onDelete: 'set null' }),
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
    // Whose event it is (drives the per-person colour on the calendar).
    assigneeId: text('assignee_id').references(() => user.id, { onDelete: 'set null' }),
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
  assignee: one(user, { fields: [task.assigneeId], references: [user.id] }),
  tags: many(taskTag),
  reminders: many(reminder),
}));

export const taskTagRelations = relations(taskTag, ({ one }) => ({
  task: one(task, { fields: [taskTag.taskId], references: [task.id] }),
  tag: one(tag, { fields: [taskTag.tagId], references: [tag.id] }),
}));
