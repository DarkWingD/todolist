// Minimal shape of the signed-in user we rely on in the UI.
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
  avatarColor: string;
  image: string | null;
}

export type ListType = 'tasks' | 'checklist' | 'child' | 'note';

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
  // Opening text of a note list, for its row. Absent on every other type.
  notePreview?: string | null;
  // Shared with the household unless set.
  private?: boolean;
  // Built-in lists only: tucked out of the index, but still receiving what is
  // sent to them.
  hidden?: boolean;
}
