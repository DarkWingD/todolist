// Minimal shape of the signed-in user we rely on in the UI.
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
  avatarColor: string;
}

// A list row from lists.mine (includes computed counts).
export interface ListSummary {
  id: string;
  name: string;
  emojiIcon: string;
  color: string | null;
  remaining: number;
  memberCount: number;
}
