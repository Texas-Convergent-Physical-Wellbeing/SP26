# Supabase RLS Policy Summary

## user_profiles
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() = user_id` — users can only read their own profile |
| INSERT | `auth.uid() = user_id` — users can only create their own profile |
| UPDATE | `auth.uid() = user_id` — users can only update their own profile |
| DELETE | `auth.uid() = user_id` — users can only delete their own profile |

## meal_plans
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() = user_id` — users can only view their own meal plans |
| INSERT | `auth.uid() = user_id` — users can only create meal plans for themselves |
| UPDATE | `auth.uid() = user_id` — users can only modify their own meal plans |
| DELETE | `auth.uid() = user_id` — users can only delete their own meal plans |

## community_posts
| Operation | Policy |
|-----------|--------|
| SELECT | `TRUE` — all authenticated users can read all posts (public community feed) |
| INSERT | `auth.uid() = author_id` — users can only create posts under their identity |
| UPDATE | `auth.uid() = author_id` — only the original author can edit title/body/recipe |
| DELETE | `auth.uid() = author_id` — only the original author can delete the post |

> **Note:** Counter columns (`upvotes`, `bookmarks`, `community_verified`) are updated
> via the service layer using the Supabase **service role key** (bypasses RLS). The
> service role key is never exposed to the frontend.

## post_interactions
| Operation | Policy |
|-----------|--------|
| SELECT | `TRUE` — all authenticated users can see interaction records (needed for client-side toggle state) |
| INSERT | `auth.uid() = user_id` — users can only record interactions under their own identity |
| DELETE | `auth.uid() = user_id` — users can only remove their own interactions (toggle off) |
| UPDATE | Not permitted — interactions are immutable once created |

> **tried_it** interactions are write-once by application logic; the service layer
> returns HTTP 409 Conflict if a user tries to submit a second `tried_it` on the
> same post.

## post_comments
| Operation | Policy |
|-----------|--------|
| SELECT | `TRUE` — all authenticated users can read all comments |
| INSERT | `auth.uid() = author_id` — users can only post comments under their own identity |
| UPDATE | `auth.uid() = author_id` — users can only edit their own comments |
| DELETE | `auth.uid() = author_id` — users can only delete their own comments |

## Service Role Key Usage
The backend uses `SUPABASE_SERVICE_KEY` (not the anon key) so that:
- Counter updates (`upvotes`, `bookmarks`, `community_verified`) bypass RLS constraints
- The `community_verified` flag is set by business logic (≥ 5 same-condition `tried_it`
  confirmations), not by direct user writes

The service key is kept server-side only and never returned to clients.
