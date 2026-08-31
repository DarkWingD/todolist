import type { TaskRowData } from '../components/TaskRow';

// Placeholder data until the API is wired up. Mirrors the approved prototype.
export const SAMPLE_USERS = {
  JD: { id: 'JD', emoji: '🦊', color: '#F59E0B', name: 'Jamie Doe' },
  SW: { id: 'SW', emoji: '🐧', color: '#3B82F6', name: 'Sam Wu' },
  MK: { id: 'MK', emoji: '🐨', color: '#10B981', name: 'Mia Khan' },
} as const;

export const SAMPLE_TODAY: TaskRowData[] = [
  { id: 'h3', title: 'Pay electricity bill', completed: false, leadEmoji: '🏡', due: 'Overdue · Mon', dueVariant: 'over' },
  { id: 'w1', title: 'Finish Q3 report', completed: false, leadEmoji: '💼', due: 'Today', dueVariant: 'due', tag: 'Priority' },
  { id: 'f1', title: 'Morning run — 5k', completed: false, leadEmoji: '🏃', due: '7:00 AM', dueVariant: 'due', recurrence: 'Daily' },
  { id: 'h1', title: 'Water the plants', completed: false, leadEmoji: '🏡', due: '5:00 PM', dueVariant: 'due', assignee: SAMPLE_USERS.SW },
  { id: 'w2', title: 'Reply to client email', completed: false, leadEmoji: '💼', due: '2:30 PM', dueVariant: 'due' },
  { id: 'h4', title: 'Buy oat milk', completed: true, leadEmoji: '🏡' },
];
