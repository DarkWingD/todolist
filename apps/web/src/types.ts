// Minimal shape of the signed-in user we rely on in the UI.
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
  avatarColor: string;
}

export type ListType = 'tasks' | 'checklist';

// A list row from lists.mine (includes computed counts).
export interface ListSummary {
  id: string;
  name: string;
  emojiIcon: string;
  color: string | null;
  type: ListType;
  remaining: number;
  memberCount: number;
}
