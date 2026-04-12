-- RPC used by community_service to atomically adjust upvotes / bookmarks on community_posts.
-- Required for POST community interaction toggles to work when not seeding counters manually.

CREATE OR REPLACE FUNCTION public.increment_post_counter(
    p_post_id UUID,
    p_column TEXT,
    p_delta INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_column = 'upvotes' THEN
        UPDATE community_posts
        SET upvotes = GREATEST(0, upvotes + p_delta)
        WHERE id = p_post_id;
    ELSIF p_column = 'bookmarks' THEN
        UPDATE community_posts
        SET bookmarks = GREATEST(0, bookmarks + p_delta)
        WHERE id = p_post_id;
    ELSE
        RAISE EXCEPTION 'invalid column for increment_post_counter: %', p_column;
    END IF;
END;
$$;

-- Allow authenticated API users and service role to call via PostgREST RPC.
GRANT EXECUTE ON FUNCTION public.increment_post_counter(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_post_counter(UUID, TEXT, INTEGER) TO service_role;
