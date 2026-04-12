-- Free-form health goal labels from onboarding (matches app quiz copy).
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS health_goals TEXT[] NOT NULL DEFAULT '{}';
