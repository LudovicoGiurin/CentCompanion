import type { users } from "../../db/schema";

export function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeName: user.storeName,
    localLeagueCity: user.localLeagueCity,
    avatarUrl: user.avatarCustom ?? user.avatarUrl,
    equippedFrame: user.equippedFrame,
    createdAt: user.createdAt,
  };
}

/** Public social card — never includes email or other private fields. */
export function socialUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeName: user.storeName,
    localLeagueCity: user.localLeagueCity,
    avatarUrl: user.avatarCustom ?? user.avatarUrl,
    equippedFrame: user.equippedFrame,
    createdAt: user.createdAt,
  };
}

/** Compact avatar URL for lists (avoids embedding base64 in JSON). */
export function listAvatarSrc(user: {
  id: number;
  avatarCustom: string | null;
  avatarUrl: string | null;
}): string | null {
  if (user.avatarCustom) return `/api/users/${user.id}/avatar`;
  return user.avatarUrl;
}
