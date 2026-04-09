-- Migration 007: cookbook_entries table
-- Stores recipes a user has saved from generated meal plans.
-- Users can annotate entries with personal modifications; adjusted_macros
-- stores their recalculated nutrition after those changes.

CREATE TABLE IF NOT EXISTS cookbook_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dish_name           TEXT NOT NULL,
    meal_type           TEXT NOT NULL CHECK (
                            meal_type IN ('breakfast','lunch','dinner','suhoor','iftar','light_snack')
                        ),
    cuisine_tag         TEXT,
    source_plan_date    DATE,
    -- Which generated plan this recipe came from (nullable = manually added)
    ingredients         JSONB NOT NULL DEFAULT '[]'::JSONB,
    -- shape: [{name, quantity, unit}]
    macros              JSONB NOT NULL,
    -- shape: {calories, protein_g, carbs_g, fat_g, fiber_g}
    micros              JSONB,
    -- shape: {sodium_mg, potassium_mg, iron_mg, ...}
    user_modifications  TEXT,
    -- Free-text notes on changes the user made to the recipe
    adjusted_macros     JSONB,
    -- Recalculated macros after user_modifications
    -- shape: {calories, protein_g, carbs_g, fat_g, fiber_g}
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER cookbook_entries_updated_at
    BEFORE UPDATE ON cookbook_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for organised browsing
CREATE INDEX IF NOT EXISTS idx_cookbook_user_id     ON cookbook_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_cookbook_meal_type   ON cookbook_entries(user_id, meal_type);
CREATE INDEX IF NOT EXISTS idx_cookbook_cuisine     ON cookbook_entries(user_id, cuisine_tag);
CREATE INDEX IF NOT EXISTS idx_cookbook_created     ON cookbook_entries(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE cookbook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY cookbook_select ON cookbook_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY cookbook_insert ON cookbook_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY cookbook_update ON cookbook_entries
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY cookbook_delete ON cookbook_entries
    FOR DELETE USING (auth.uid() = user_id);
