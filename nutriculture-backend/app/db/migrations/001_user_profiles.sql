-- Migration 001: user_profiles table
-- Stores per-user health profile, allergens, cuisine preferences, and computed nutrition targets.

CREATE TABLE IF NOT EXISTS user_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sex             TEXT NOT NULL CHECK (sex IN ('male', 'female', 'other')),
    age             INTEGER NOT NULL CHECK (age > 0 AND age < 150),
    weight_kg       NUMERIC(6, 2) NOT NULL CHECK (weight_kg > 0),
    height_cm       NUMERIC(6, 2) NOT NULL CHECK (height_cm > 0),
    health_conditions TEXT[] NOT NULL DEFAULT '{}',
    allergens       TEXT[] NOT NULL DEFAULT '{}',
    cuisines        TEXT[] NOT NULL DEFAULT '{}'
                        CHECK (array_length(cuisines, 1) IS NULL OR array_length(cuisines, 1) <= 3),
    diet_preferences TEXT[] NOT NULL DEFAULT '{}',
    tdee            NUMERIC(8, 2),
    macro_targets   JSONB,
    -- macro_targets shape: {calories, protein_g, carbs_g, fat_g, fiber_g}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read and write their own profile
CREATE POLICY user_profiles_select ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_profiles_insert ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_profiles_update ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_profiles_delete ON user_profiles
    FOR DELETE USING (auth.uid() = user_id);
