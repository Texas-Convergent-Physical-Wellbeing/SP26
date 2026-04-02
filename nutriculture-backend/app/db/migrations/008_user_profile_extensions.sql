-- Migration 008: Extend user_profiles with skill level, festive mode columns.
-- Run after 001_user_profiles.sql.

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS skill_level TEXT NOT NULL DEFAULT 'intermediate'
        CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),

    ADD COLUMN IF NOT EXISTS shortcut_mode BOOLEAN NOT NULL DEFAULT FALSE,
    -- When TRUE and skill_level = 'beginner': LLM flags store-bought shortcuts

    ADD COLUMN IF NOT EXISTS active_festive_event TEXT
        CHECK (active_festive_event IN (
            'ramadan', 'diwali', 'eid', 'lunar_new_year',
            'passover', 'navratri', 'christmas'
        )),
    -- NULL = no active festive mode

    ADD COLUMN IF NOT EXISTS festive_event_start DATE,
    ADD COLUMN IF NOT EXISTS festive_event_end   DATE;
