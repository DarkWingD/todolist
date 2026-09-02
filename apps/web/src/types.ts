// Minimal shape of the signed-in user we rely on in the UI.
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
  avatarColor: string;
  image: string | null;
}

export type ListType = 'tasks' | 'checklist';

// A list row from lists.mine / lists.reminders (includes computed counts).
export interface ListSummary {
  id: string;
  name: string;
  emojiIcon: string;
  color: string | null;
  type: ListType;
  remaining: number;
  memberCount: number;
  // Set for app-managed lists (e.g. 'reminders'); null/absent for user lists.
  systemKey?: string | null;
}
