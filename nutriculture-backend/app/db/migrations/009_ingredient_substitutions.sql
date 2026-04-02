-- Migration 009: ingredient_substitutions cache table
-- Caches LLM-generated substitution suggestions keyed by ingredient name
-- to avoid redundant Claude calls for common substitution requests.

CREATE TABLE IF NOT EXISTS ingredient_substitutions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_name     TEXT NOT NULL,
    context_conditions  TEXT[] NOT NULL DEFAULT '{}',
    -- Health conditions under which these substitutes were generated.
    -- Same ingredient may have different substitutes for e.g. kidney disease vs. baseline.
    substitutes         JSONB NOT NULL DEFAULT '[]'::JSONB,
    -- shape: [{name, notes, gluten_free, vegan, availability_notes}]
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ingredient_name)
    -- Single cache entry per ingredient (condition-agnostic cache key for simplicity;
    -- conditions are embedded in the substitutes payload).
);

CREATE INDEX IF NOT EXISTS idx_ingredient_subs_name ON ingredient_substitutions(ingredient_name);

-- No RLS — this is a shared read cache. Service layer uses service-role key.
-- Inserts/updates are performed only by the backend, never by clients directly.
