-- Migration 003: community_posts table
-- Stores user-submitted adapted recipe posts for the community feed.
--
-- adapted_recipe shape (same as a single meal object):
-- {
--   meal_type, dish_name, cuisine_tag, original_dish, adapted_dish,
--   why_this_works, ingredients, macros, micros, glycemic_notes, portion_size
-- }

CREATE TABLE IF NOT EXISTS community_posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title               TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
    body                TEXT NOT NULL CHECK (char_length(body) >= 10),
    adapted_recipe      JSONB,
    condition_tags      TEXT[] NOT NULL DEFAULT '{}',
    cuisine_tag         TEXT,
    upvotes             INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
    bookmarks           INTEGER NOT NULL DEFAULT 0 CHECK (bookmarks >= 0),
    community_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for common feed query patterns
CREATE INDEX IF NOT EXISTS idx_community_posts_author_id       ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_condition_tags  ON community_posts USING GIN(condition_tags);
CREATE INDEX IF NOT EXISTS idx_community_posts_cuisine_tag     ON community_posts(cuisine_tag);
CREATE INDEX IF NOT EXISTS idx_community_posts_upvotes         ON community_posts(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at      ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_verified        ON community_posts(community_verified);

-- Row Level Security
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read posts (public community feed)
CREATE POLICY community_posts_select ON community_posts
    FOR SELECT USING (TRUE);

-- Only the author can create posts under their own author_id
CREATE POLICY community_posts_insert ON community_posts
    FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Only the author can update their own post (title/body/recipe)
CREATE POLICY community_posts_update ON community_posts
    FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- Only the author can delete their own post
CREATE POLICY community_posts_delete ON community_posts
    FOR DELETE USING (auth.uid() = author_id);
