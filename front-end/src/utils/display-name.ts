import type { User } from '@supabase/supabase-js';

function pickStr(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

/** Display name from Supabase user (metadata first, then a readable email local-part). */
export function displayNameFromUser(user: User | null | undefined): string {
  if (!user) return 'Your name';
  const m = user.user_metadata ?? {};
  const full = pickStr(m.full_name);
  if (full) return full;
  const name = pickStr(m.name);
  if (name) return name;
  const disp = pickStr(m.display_name);
  if (disp) return disp;
  const given = pickStr(m.given_name);
  const fam = pickStr(m.family_name);
  if (given || fam) return [given, fam].filter(Boolean).join(' ');
  const first = pickStr(m.first_name);
  const last = pickStr(m.last_name);
  if (first || last) return [first, last].filter(Boolean).join(' ');
  if (user.email) {
    const local = user.email.split('@')[0];
    if (local) {
      return local
        .replace(/[._+-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
    }
  }
  return 'Your name';
}

export function avatarUriFromUser(user: User | null | undefined): string | null {
  if (!user) return null;
  const m = user.user_metadata ?? {};
  const url = pickStr(m.avatar_url) || pickStr(m.picture);
  return url || null;
}
