/**
 * Module-level store for quiz answers.
 * Persists across screen navigation without needing React Context.
 *
 * Hydration strategy:
 * - `hydrateQuizFromServer()` fetches the saved profile and fills the store,
 *   but only ONCE per quiz session (tracked by `_sessionHydrated`).
 * - Subsequent screens calling `hydrateQuizFromServer()` are no-ops, so the
 *   user's in-progress selections aren't overwritten.
 * - Call `resetQuizStore()` at the start of a fresh quiz flow to clear the
 *   flag and start from the server state again.
 */

import type {
  ActivityLevel,
  Allergen,
  Cuisine,
  DietPreference,
  HealthCondition,
  UserProfileRequest,
  UserProfileResponse,
} from './api';
import { api, getAuthToken } from './api';

export interface QuizStore {
  /** Step 1 – health goal labels (also persisted on user_profiles.health_goals). */
  goals: string[];
  /** Step 2 – biometrics */
  sex: 'male' | 'female' | 'other';
  sexExplicitlySet: boolean;
  age: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  /** Step 3 – cuisines (max 3) */
  cuisines: Cuisine[];
  /** Step 4 – health conditions */
  health_conditions: HealthCondition[];
  /** Step 5 – allergens / dietary restrictions */
  allergens: Allergen[];
  /** Step 6 – diet preferences */
  diet_preferences: DietPreference[];
}

export const quizStore: QuizStore = {
  goals: [],
  sex: 'male',
  sexExplicitlySet: false,
  age: 0,
  weight_kg: 0,
  height_cm: 0,
  activity_level: 'moderately_active',
  cuisines: [],
  health_conditions: [],
  allergens: [],
  diet_preferences: [],
};

/** True after the first successful server hydration; prevents later screens from
 *  overwriting answers the user already selected. */
let _sessionHydrated = false;

/** Reset the store AND the session flag so the next quiz entry re-fetches. */
export function resetQuizStore() {
  quizStore.goals = [];
  quizStore.sex = 'male';
  quizStore.sexExplicitlySet = false;
  quizStore.age = 0;
  quizStore.weight_kg = 0;
  quizStore.height_cm = 0;
  quizStore.activity_level = 'moderately_active';
  quizStore.cuisines = [];
  quizStore.health_conditions = [];
  quizStore.allergens = [];
  quizStore.diet_preferences = [];
  _sessionHydrated = false;
}

/** Copy server profile into the in-memory quiz store (best-effort). */
export function hydrateQuizStoreFromProfile(p: UserProfileResponse) {
  const goals = p.health_goals;
  quizStore.goals = Array.isArray(goals) ? [...goals] : [];
  const sx = p.sex as string;
  quizStore.sex = sx === 'female' || sx === 'other' ? sx : 'male';
  quizStore.sexExplicitlySet = sx === 'male' || sx === 'female' || sx === 'other';
  quizStore.age = Number(p.age) || 0;
  quizStore.weight_kg = Number(p.weight_kg) || 0;
  quizStore.height_cm = Number(p.height_cm) || 0;
  quizStore.cuisines = (p.cuisines ?? []) as Cuisine[];
  quizStore.health_conditions = (p.health_conditions ?? []) as HealthCondition[];
  quizStore.allergens = (p.allergens ?? []) as Allergen[];
  quizStore.diet_preferences = (p.diet_preferences ?? []) as DietPreference[];
}

/**
 * Load saved profile into quizStore — but only once per quiz session.
 * Every quiz screen calls this; only the first call hits the network.
 * Subsequent calls return `null` immediately (store is already populated).
 */
export async function hydrateQuizFromServer(): Promise<UserProfileResponse | null> {
  if (_sessionHydrated) return null;
  if (!getAuthToken()) return null;
  try {
    const p = await api.getProfile();
    hydrateQuizStoreFromProfile(p);
    _sessionHydrated = true;
    return p;
  } catch {
    // 404 (no profile yet) or network error — mark hydrated so we don't retry
    // on every screen and just let the user fill in fresh values.
    _sessionHydrated = true;
    return null;
  }
}

/**
 * Build PUT /profile body from the quiz store, filling gaps from `existing`
 * so skipped steps keep server values (e.g. allergens not edited in the quiz).
 */
export function buildProfileUpsertFromQuiz(
  dietSelected: DietPreference[],
  existing: UserProfileResponse | null,
): UserProfileRequest {
  const ex = existing;
  const allergens = (
    quizStore.allergens.length ? quizStore.allergens : (ex?.allergens ?? [])
  ) as Allergen[];
  const skill_level = ex?.skill_level ?? 'intermediate';
  const shortcut_mode = ex?.shortcut_mode ?? false;

  const sex = (quizStore.sex || ex?.sex || 'male') as 'male' | 'female' | 'other';
  const age = quizStore.age > 0 ? quizStore.age : (ex?.age ?? 25);
  const weight_kg = quizStore.weight_kg > 0 ? quizStore.weight_kg : (ex?.weight_kg ?? 70);
  const height_cm = quizStore.height_cm > 0 ? quizStore.height_cm : (ex?.height_cm ?? 170);

  const health_conditions = (
    quizStore.health_conditions.length ? quizStore.health_conditions : (ex?.health_conditions ?? [])
  ) as HealthCondition[];

  const cuisines = (quizStore.cuisines.length ? quizStore.cuisines : (ex?.cuisines ?? [])) as Cuisine[];

  const diet_preferences = (
    dietSelected.length ? dietSelected : ((ex?.diet_preferences?.length ? ex.diet_preferences : ['none']) as DietPreference[])
  );

  return {
    sex,
    age,
    weight_kg,
    height_cm,
    activity_level: quizStore.activity_level,
    health_conditions,
    allergens,
    cuisines,
    diet_preferences,
    health_goals: [...quizStore.goals],
    skill_level,
    shortcut_mode,
  };
}
