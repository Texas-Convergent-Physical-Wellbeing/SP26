-- Migration 005: post_comments table
-- Threaded comments on community posts.
-- parent_comment_id is self-referential (NULL = top-level comment).

CREATE TABLE IF NOT EXISTS post_comments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id             UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body                TEXT NOT NULL CHECK (
                            char_length(body) >= 1 AND char_length(body) <= 1000
                        ),
    parent_comment_id   UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    -- NULL → top-level comment; non-NULL → reply to another comment
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER post_comments_updated_at
    BEFORE UPDATE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id          ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_author_id        ON post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent           ON post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_parent      ON post_comments(post_id, parent_comment_id);

-- Row Level Security
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments
CREATE POLICY post_comments_select ON post_comments
    FOR SELECT USING (TRUE);

-- Users can only insert comments under their own author_id
CREATE POLICY post_comments_insert ON post_comments
    FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Users can only update their own comments
CREATE POLICY post_comments_update ON post_comments
    FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- Users can only delete their own comments
CREATE POLICY post_comments_delete ON post_comments
    FOR DELETE USING (auth.uid() = author_id);
