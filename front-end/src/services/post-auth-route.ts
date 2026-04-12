import type { Href } from 'expo-router';

import { ONBOARDING_HREF, PROFILE_HREF, isProfileMissingError } from '@/constants/navigation';
import { api, setAuthToken } from '@/services/api';

/**
 * After Supabase has a session, decide where to send the user:
 * - Profile exists  → go straight to /profile
 * - No profile yet  → go to quiz-goals (start the onboarding quiz directly)
 */
export async function getPostAuthHref(accessToken: string): Promise<Href> {
  setAuthToken(accessToken);
  try {
    await api.getProfile();
    return PROFILE_HREF;
  } catch (e) {
    if (isProfileMissingError(e)) {
      return ONBOARDING_HREF;
    }
    return PROFILE_HREF;
  }
}
