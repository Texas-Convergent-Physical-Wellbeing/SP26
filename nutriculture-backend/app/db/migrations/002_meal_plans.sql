-- Migration 002: meal_plans table
-- Stores LLM-generated daily meal plans per user.
-- meals is a JSONB array of 3 meal objects (breakfast, lunch, dinner).
--
-- Each meal object shape:
-- {
--   meal_type: "breakfast"|"lunch"|"dinner",
--   dish_name: string,
--   cuisine_tag: string,
--   original_dish: string,
--   adapted_dish: string,
--   why_this_works: string,
--   ingredients: [{name, quantity, unit}],
--   macros: {calories, protein_g, carbs_g, fat_g, fiber_g},
--   micros: {sodium_mg, potassium_mg, iron_mg, ...},
--   glycemic_notes: string|null,
--   portion_size: string
-- }

CREATE TABLE IF NOT EXISTS meal_plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_date   DATE NOT NULL,
    meals       JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, plan_date)
);

CREATE TRIGGER meal_plans_updated_at
    BEFORE UPDATE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id       ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_plan_date     ON meal_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date     ON meal_plans(user_id, plan_date);

-- Row Level Security
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own meal plans
CREATE POLICY meal_plans_select ON meal_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY meal_plans_insert ON meal_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY meal_plans_update ON meal_plans
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY meal_plans_delete ON meal_plans
    FOR DELETE USING (auth.uid() = user_id);
