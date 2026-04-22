/**
 * Tracks the currently-authenticated Supabase user id across the app and lets
 * other persisted stores namespace their AsyncStorage keys per-user.
 *
 * Why this exists:
 *   Chat history, chat recipes and bookmarks were previously written to a
 *   single global AsyncStorage key — so when two accounts signed in on the
 *   same device, the second one inherited the first user's data. Everything
 *   that should be "private to the signed-in account" should route its
 *   storage key through `scopedKey(...)` and subscribe to
 *   `subscribeCurrentUser` so it can reset its in-memory state when the
 *   active user changes.
 *
 * Community posts intentionally do NOT use this store — they're meant to be
 * visible to every account in the app.
 */

let userId: string | null = null;
let userName: string | null = null;
const listeners = new Set<(uid: string | null) => void>();

export function getCurrentUserId(): string | null {
  return userId;
}

/**
 * Display name of the signed-in user — pulled from Supabase user metadata
 * (full_name / name / email local-part). Used to attribute community posts
 * and comments so other accounts on the same device can see WHO authored
 * each piece of content.
 */
export function getCurrentUserName(): string | null {
  return userName;
}

export function setCurrentUserId(next: string | null | undefined): void {
  const normalized =
    typeof next === 'string' && next.trim().length > 0 ? next : null;
  if (userId === normalized) return;
  userId = normalized;
  // The user changed — clear the cached name so we don't briefly show the
  // previous user's display name until the next setCurrentUserName call.
  userName = null;
  listeners.forEach((l) => {
    try {
      l(userId);
    } catch {
      // listeners must not break the app
    }
  });
}

/**
 * Set the display name for the currently-signed-in user. Called after
 * `setCurrentUserId` from the auth bootstrap; pure metadata, does NOT
 * trigger a user-change broadcast (the id already did that).
 */
export function setCurrentUserName(next: string | null | undefined): void {
  const normalized =
    typeof next === 'string' && next.trim().length > 0 ? next.trim() : null;
  userName = normalized;
}

export function subscribeCurrentUser(
  listener: (uid: string | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns a per-user-namespaced AsyncStorage key. Signed-out users share a
 * single "anon" bucket; signed-in users each get their own.
 *
 *   scopedKey('nutriculture.chatBookmarks.v1')
 *     // → 'nutriculture.chatBookmarks.v1:anon'              (signed out)
 *     // → 'nutriculture.chatBookmarks.v1:3b0f…user uuid…'   (signed in)
 */
export function scopedKey(baseKey: string): string {
  const bucket = userId ?? 'anon';
  return `${baseKey}:${bucket}`;
}
