/**
 * API service for the NutriCulture backend.
 *
 * Base URL resolution:
 * 1. If `EXPO_PUBLIC_API_BASE_URL` is set in front-end/.env (e.g. http://192.168.1.42:8000), it wins.
 *    Use this when Expo’s inferred host (Metro) is not the same IP your phone can reach.
 * 2. In dev, otherwise use the host from Expo (same machine as Metro) on port 8000.
 * 3. Fallback `http://localhost:8000` (simulator / web).
 *
 * Auth: call setAuthToken() with the Supabase JWT after login.
 */

import Constants from 'expo-constants';

function getBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (override) {
    return override.replace(/\/$/, '');
  }
  if (__DEV__) {
    // Expo's dev server runs on your machine's LAN IP — reuse that host
    // so physical devices and emulators can reach the backend.
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:8000`;
    }
  }
  return 'http://localhost:8000';
}

/** Resolved once at module load; use `getApiBaseUrl()` if you need the latest env after hot reload. */
export const BASE_URL = getBaseUrl();

export function getApiBaseUrl(): string {
  return getBaseUrl();
}

let _token = '';
export function setAuthToken(token: string) { _token = token; }
export function getAuthToken() { return _token; }

function formatErrorBody(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item === 'object' && item !== null && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : JSON.stringify(item),
        )
        .join('; ');
    }
    if (detail && typeof detail === 'object') {
      const o = detail as { error?: string; detail?: string; code?: string };
      if (typeof o.detail === 'string') return o.detail;
      if (typeof o.error === 'string') return o.error;
      return JSON.stringify(detail);
    }
  }
  return `HTTP ${status}`;
}

async function req<T>(method: string, path: string, body?: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ..._token ? { Authorization: `Bearer ${_token}` } : {},
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const hint =
      __DEV__
        ? ` Trying: ${getApiBaseUrl()}. Start the API: cd nutriculture-backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000. Optional: set EXPO_PUBLIC_API_BASE_URL in front-end/.env if this host is wrong, then restart Expo.`
        : '';
    throw new Error(
      e instanceof Error && e.message
        ? `${e.message}.${hint}`
        : `Network error.${hint}`,
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatErrorBody(err, res.status));
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active';

export type HealthCondition =
  | 'type2_diabetes'
  | 'hypertension'
  | 'pcos'
  | 'high_cholesterol'
  | 'celiac'
  | 'kidney_disease'
  | 'none';

export type Cuisine =
  | 'south_asian'
  | 'west_african'
  | 'east_asian'
  | 'latin_american'
  | 'middle_eastern'
  | 'mediterranean'
  | 'southeast_asian'
  | 'caribbean';

export type DietPreference = 'halal' | 'kosher' | 'vegetarian' | 'vegan' | 'none';

export type Allergen =
  | 'celery' | 'gluten' | 'crustaceans' | 'eggs' | 'fish' | 'lupin'
  | 'milk' | 'molluscs' | 'mustard' | 'peanuts' | 'sesame'
  | 'soybeans' | 'sulphur_dioxide' | 'tree_nuts';

export interface UserProfileRequest {
  sex: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  health_conditions: HealthCondition[];
  allergens: Allergen[];
  cuisines: Cuisine[];
  diet_preferences: DietPreference[];
  /** Labels from the Health Goals quiz step (e.g. "Lose Weight"). */
  health_goals?: string[];
  skill_level?: string;
  shortcut_mode?: boolean;
}

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg_max?: number;
}

export interface UserProfileResponse {
  id: string;
  user_id: string;
  sex: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  health_conditions: string[];
  allergens: string[];
  cuisines: string[];
  diet_preferences: string[];
  /** Present once DB migration `011_health_goals` is applied. */
  health_goals?: string[];
  skill_level: string;
  shortcut_mode: boolean;
  active_festive_event: string | null;
  festive_event_start?: string | null;
  festive_event_end?: string | null;
  tdee: number | null;
  macro_targets: MacroTargets | null;
  created_at: string;
  updated_at: string;
}

export interface MacroTargetsResponse {
  macro_targets: MacroTargets;
  tdee: number;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export const api = {
  upsertProfile: (data: UserProfileRequest) =>
    req<UserProfileResponse>('PUT', '/api/v1/users/profile', data),

  getProfile: () =>
    req<UserProfileResponse>('GET', '/api/v1/users/profile'),

  getMacros: () =>
    req<MacroTargetsResponse>('GET', '/api/v1/users/profile/macros'),
};
