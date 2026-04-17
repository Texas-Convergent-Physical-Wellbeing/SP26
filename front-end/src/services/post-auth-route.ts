import type { Href } from 'expo-router';

import { ONBOARDING_HREF, PROFILE_HREF, isProfileMissingError } from '@/constants/navigation';
import { api, setAuthToken } from '@/services/api';

const TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms),
    ),
  ]);
}

/**
 * After Supabase has a session, decide where to send the user:
 * - Profile exists  → go straight to /profile
 * - No profile yet  → go to quiz-goals (start the onboarding quiz directly)
 * - Backend unreachable / timeout → go to /profile (handles its own error state)
 */
export async function getPostAuthHref(accessToken: string): Promise<Href> {
  setAuthToken(accessToken);
  try {
    await withTimeout(api.getProfile(), TIMEOUT_MS);
    return PROFILE_HREF;
  } catch (e) {
    if (isProfileMissingError(e)) {
      return ONBOARDING_HREF;
    }
    return PROFILE_HREF;
  }
}
