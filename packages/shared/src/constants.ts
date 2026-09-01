// Shared enums/constants used across API, worker, and web.

export const THEMES = ['tento', 'nudge', 'momentum'] as const;
export type Theme = (typeof THEMES)[number];

export const APPEARANCES = ['system', 'light', 'dark'] as const;
export type Appearance = (typeof APPEARANCES)[number];

export const DENSITIES = ['comfortable', 'cozy', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

export const TEXT_SCALE = { min: 0.88, max: 1.14, default: 0.96, step: 0.02 } as const;

export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const LIST_ROLES = ['owner', 'member'] as const;
export type ListRole = (typeof LIST_ROLES)[number];

export const LIST_TYPES = ['tasks', 'checklist'] as const;
export type ListType = (typeof LIST_TYPES)[number];

export const REMINDER_CHANNELS = ['email', 'push', 'in_app'] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const CALENDAR_VIEWS = ['month', 'week', 'agenda', 'list'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const DEFAULT_PREFS = {
  theme: 'nudge' as Theme,
  appearance: 'system' as Appearance,
  density: 'cozy' as Density,
  textScale: TEXT_SCALE.default,
};
