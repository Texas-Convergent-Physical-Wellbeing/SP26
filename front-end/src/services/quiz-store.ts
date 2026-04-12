/**
 * Module-level store for quiz answers.
 * Persists across screen navigation without needing React Context.
 * Call reset() if the user restarts onboarding.
 */

import { ActivityLevel, Cuisine, DietPreference, HealthCondition } from './api';

export interface QuizStore {
  /** Step 1 – free-form goals (UI only, not sent to backend) */
  goals: string[];
  /** Step 2 – biometrics */
  sex: 'male' | 'female' | 'other';
  age: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  /** Step 3 – cuisines (max 3) */
  cuisines: Cuisine[];
  /** Step 4 – health conditions */
  health_conditions: HealthCondition[];
  /** Step 5 – diet preferences */
  diet_preferences: DietPreference[];
}

export const quizStore: QuizStore = {
  goals: [],
  sex: 'male',
  age: 0,
  weight_kg: 0,
  height_cm: 0,
  activity_level: 'moderately_active',
  cuisines: [],
  health_conditions: [],
  diet_preferences: [],
};

export function resetQuizStore() {
  quizStore.goals = [];
  quizStore.sex = 'male';
  quizStore.age = 0;
  quizStore.weight_kg = 0;
  quizStore.height_cm = 0;
  quizStore.activity_level = 'moderately_active';
  quizStore.cuisines = [];
  quizStore.health_conditions = [];
  quizStore.diet_preferences = [];
}
