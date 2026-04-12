/**
 * API service for the NutriCulture backend.
 * Base URL: update BASE_URL to point to your running backend.
 * Auth: call setAuthToken() with the Supabase JWT after login.
 */

import Constants from 'expo-constants';

function getBaseUrl(): string {
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

export const BASE_URL = getBaseUrl();

let _token = '';
export function setAuthToken(token: string) { _token = token; }
export function getAuthToken() { return _token; }

async function req<T>(method: string, path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ..._token ? { Authorization: `Bearer ${_token}` } : {},
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `HTTP ${res.status}`);
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
  | 'diabetesI'
  | 'heart_disease'
  | 'diabetesII'
  | 'celiac_disease'
  | 'hypertension'
  | 'obesity'
  | 'osteoporosis'
  | 'other'
  | 'none';

export type Cuisine =
  | 'italian'
  | 'chinese'
  | 'mexican'
  | 'indian'
  | 'thai'
  | 'greek'
  | 'french'
  | 'other';

export type DietPreference = 
  | 'vegetarian' 
  | 'vegan' 
  | 'halal' 
  | 'kosher' 
  | 'gluten_free'
  | 'lactose_intolerant'
  | 'keto'
  | 'other';

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
  skill_level: string;
  shortcut_mode: boolean;
  active_festive_event: string | null;
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
