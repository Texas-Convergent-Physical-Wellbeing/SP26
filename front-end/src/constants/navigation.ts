import type { Href } from 'expo-router';

/** Unauthenticated landing / welcome screen. */
export const WELCOME_HREF = '/onboarding' as unknown as Href;

/** `/login` — sign-in / sign-up screen. */
export const LOGIN_HREF = '/login' as unknown as Href;

/** First-time users go straight to the quiz (no welcome intermediary). */
export const ONBOARDING_HREF = '/quiz-goals' as unknown as Href;

/** After login, go directly to profile. */
export const PROFILE_HREF = '/profile' as unknown as Href;

/** Main app tabs (kept for backwards compat; routes inside may redirect to profile). */
export const TABS_HREF = '/profile' as unknown as Href;

export function isProfileMissingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /not found|404|PROFILE_NOT_FOUND/i.test(err.message);
}
