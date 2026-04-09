-- Migration 006: meal_feedback table
-- Records user reactions to individual generated meals for taste learning.
-- The LLM reads recent feedback to adapt future meal plan generation.

CREATE TABLE IF NOT EXISTS meal_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_date       DATE NOT NULL,
    meal_type       TEXT NOT NULL CHECK (
                        meal_type IN ('breakfast','lunch','dinner','suhoor','iftar','light_snack')
                    ),
    dish_name       TEXT NOT NULL,
    cuisine_tag     TEXT,
    action          TEXT NOT NULL CHECK (action IN ('saved','skipped','modified')),
    modification_notes  TEXT,
    -- Free-text description of what the user changed
    modified_macros JSONB,
    -- User-estimated macros after their modifications
    -- shape: {calories, protein_g, carbs_g, fat_g, fiber_g}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast preference lookups
CREATE INDEX IF NOT EXISTS idx_meal_feedback_user_id    ON meal_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_feedback_action     ON meal_feedback(user_id, action);
CREATE INDEX IF NOT EXISTS idx_meal_feedback_cuisine    ON meal_feedback(user_id, cuisine_tag);
CREATE INDEX IF NOT EXISTS idx_meal_feedback_recent     ON meal_feedback(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE meal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_feedback_select ON meal_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY meal_feedback_insert ON meal_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY meal_feedback_delete ON meal_feedback
    FOR DELETE USING (auth.uid() = user_id);
