-- Migration 004: post_interactions table
-- Tracks per-user interactions on community posts: upvote, bookmark, tried_it.
-- Uniqueness constraint ensures a user can only have one of each type per post.

CREATE TABLE IF NOT EXISTS post_interactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id             UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    interaction_type    TEXT NOT NULL CHECK (interaction_type IN ('upvote', 'bookmark', 'tried_it')),
    macro_confirmation  JSONB,
    -- macro_confirmation: user-submitted macros on tried_it, nullable
    -- shape: {calories, protein_g, carbs_g, fat_g, fiber_g}
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, user_id, interaction_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_interactions_post_id       ON post_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_interactions_user_id       ON post_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_interactions_type          ON post_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_post_interactions_tried_it      ON post_interactions(post_id, interaction_type)
    WHERE interaction_type = 'tried_it';

-- Row Level Security
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;

-- Users can read all interactions (needed for toggle-state UI)
CREATE POLICY post_interactions_select ON post_interactions
    FOR SELECT USING (TRUE);

-- Users can only insert interactions under their own user_id
CREATE POLICY post_interactions_insert ON post_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own interactions (toggle off upvote/bookmark)
CREATE POLICY post_interactions_delete ON post_interactions
    FOR DELETE USING (auth.uid() = user_id);
