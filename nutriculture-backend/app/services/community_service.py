"""Business logic for community posts, interactions, and comments."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

from app.models.community import (
    CommunityPostResponse,
    CommunityPostListResponse,
    InteractionResult,
    DeleteInteractionResult,
    CommentResponse,
    CreatePostRequest,
    AdaptedRecipe,
)

logger = logging.getLogger(__name__)

_POSTS_TABLE = "community_posts"
_INTERACTIONS_TABLE = "post_interactions"
_COMMENTS_TABLE = "post_comments"

# Number of same-condition tried_it confirmations required for community_verified
_VERIFIED_THRESHOLD = 5


async def create_post(
    author_id: str,
    request: CreatePostRequest,
    db: AsyncClient,
) -> CommunityPostResponse:
    """Insert a new community post.

    Args:
        author_id: Authenticated user UUID (becomes the post author).
        request: Validated post creation payload.
        db: Supabase async client.

    Returns:
        The created ``CommunityPostResponse``.
    """
    recipe_dict = request.adapted_recipe.model_dump() if request.adapted_recipe else None
    payload = {
        "author_id": author_id,
        "title": request.title,
        "body": request.body,
        "adapted_recipe": recipe_dict,
        "condition_tags": request.condition_tags,
        "cuisine_tag": request.cuisine_tag,
    }
    result = await db.table(_POSTS_TABLE).insert(payload).execute()
    row = _extract_single(result, "insert post")
    return _post_row_to_response(row)


async def list_posts(
    db: AsyncClient,
    condition: Optional[str] = None,
    cuisine: Optional[str] = None,
    verified_only: bool = False,
    sort: str = "recent",
    limit: int = 20,
    offset: int = 0,
) -> CommunityPostListResponse:
    """Return a filtered and paginated list of community posts.

    Args:
        db: Supabase async client.
        condition: Filter to posts tagged with this health condition.
        cuisine: Filter to posts tagged with this cuisine.
        verified_only: If True, return only community-verified posts.
        sort: ``"recent"`` (by created_at desc) or ``"upvotes"`` (by upvotes desc).
        limit: Max records to return.
        offset: Records to skip.

    Returns:
        ``CommunityPostListResponse`` with filtered posts and pagination metadata.
    """
    query = db.table(_POSTS_TABLE).select("*", count="exact")

    if condition:
        query = query.contains("condition_tags", [condition])
    if cuisine:
        query = query.eq("cuisine_tag", cuisine)
    if verified_only:
        query = query.eq("community_verified", True)

    order_col = "created_at" if sort == "recent" else "upvotes"
    query = query.order(order_col, desc=True).range(offset, offset + limit - 1)

    result = await query.execute()
    rows = result.data or []
    total = result.count or 0
    posts = [_post_row_to_response(r) for r in rows]
    return CommunityPostListResponse(posts=posts, total=total, limit=limit, offset=offset)


async def get_post(post_id: str, db: AsyncClient) -> CommunityPostResponse:
    """Fetch a single community post by ID.

    Args:
        post_id: UUID of the post to retrieve.
        db: Supabase async client.

    Returns:
        The requested ``CommunityPostResponse``.

    Raises:
        HTTPException: 404 if the post is not found.
    """
    result = (
        await db.table(_POSTS_TABLE)
        .select("*")
        .eq("id", post_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Post not found",
                "code": "POST_NOT_FOUND",
                "detail": f"No community post with id {post_id}.",
            },
        )
    return _post_row_to_response(result.data)


async def toggle_interaction(
    user_id: str,
    post_id: str,
    interaction_type: str,
    db: AsyncClient,
    macro_confirmation: Optional[dict] = None,
) -> InteractionResult:
    """Toggle an upvote or bookmark, or record a tried_it (write-once).

    - upvote / bookmark: insert if absent (active=True), delete if present (active=False),
      then update the counter on the post.
    - tried_it: insert only; raises 409 if already recorded; after insert checks
      whether ≥ 5 users with the same condition_tag have confirmed → sets
      community_verified = True on the post.

    Args:
        user_id: Authenticated user UUID.
        post_id: Target post UUID.
        interaction_type: One of ``"upvote"``, ``"bookmark"``, ``"tried_it"``.
        db: Supabase async client.
        macro_confirmation: Optional macro dict submitted with tried_it.

    Returns:
        ``InteractionResult`` describing the new state.

    Raises:
        HTTPException: 409 if a tried_it already exists for this user/post.
        HTTPException: 404 if the post does not exist.
    """
    post = await get_post(post_id, db)

    existing = await _find_interaction(user_id, post_id, interaction_type, db)

    if interaction_type == "tried_it":
        return await _handle_tried_it(
            user_id, post_id, existing, macro_confirmation, post, db
        )
    return await _handle_toggle(
        user_id, post_id, interaction_type, existing, post, db
    )


async def add_comment(
    author_id: str,
    post_id: str,
    body: str,
    parent_comment_id: Optional[str],
    db: AsyncClient,
) -> CommentResponse:
    """Add a top-level or threaded comment to a post.

    Args:
        author_id: Authenticated user UUID.
        post_id: Target post UUID.
        body: Comment text (1–1000 chars, enforced by DB constraint).
        parent_comment_id: UUID of parent comment for threading, or None.
        db: Supabase async client.

    Returns:
        The created ``CommentResponse`` (replies list will be empty).
    """
    payload = {
        "post_id": post_id,
        "author_id": author_id,
        "body": body,
        "parent_comment_id": parent_comment_id,
    }
    result = await db.table(_COMMENTS_TABLE).insert(payload).execute()
    row = _extract_single(result, "insert comment")
    return _comment_row_to_response(row)


async def list_comments(post_id: str, db: AsyncClient) -> list[CommentResponse]:
    """Return threaded comments for a post (parents with nested children).

    Fetches all comments for the post, then assembles a tree structure so
    top-level comments include a ``replies`` list of their direct children.

    Args:
        post_id: Target post UUID.
        db: Supabase async client.

    Returns:
        List of top-level ``CommentResponse`` objects with nested replies.
    """
    result = (
        await db.table(_COMMENTS_TABLE)
        .select("*")
        .eq("post_id", post_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = result.data or []
    return _build_comment_tree(rows)


async def remove_interaction(
    user_id: str,
    post_id: str,
    interaction_type: str,
    db: AsyncClient,
) -> DeleteInteractionResult:
    """Remove an upvote or bookmark interaction and decrement the counter.

    Args:
        user_id: Authenticated user UUID.
        post_id: Target post UUID.
        interaction_type: ``"upvote"`` or ``"bookmark"`` (tried_it cannot be removed).
        db: Supabase async client.

    Returns:
        ``DeleteInteractionResult`` with active=False.

    Raises:
        HTTPException: 400 if interaction_type is tried_it.
        HTTPException: 404 if no such interaction exists to remove.
    """
    if interaction_type == "tried_it":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Cannot remove tried_it",
                "code": "TRIED_IT_IMMUTABLE",
                "detail": "tried_it interactions cannot be deleted.",
            },
        )

    existing = await _find_interaction(user_id, post_id, interaction_type, db)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Interaction not found",
                "code": "INTERACTION_NOT_FOUND",
                "detail": f"No {interaction_type} interaction found for this user/post.",
            },
        )

    await db.table(_INTERACTIONS_TABLE).delete().eq("id", existing["id"]).execute()
    updated_post = await _decrement_counter(post_id, interaction_type, db)
    return DeleteInteractionResult(
        interaction_type=interaction_type,
        active=False,
        post_upvotes=updated_post.get("upvotes"),
        post_bookmarks=updated_post.get("bookmarks"),
    )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


async def _find_interaction(
    user_id: str, post_id: str, interaction_type: str, db: AsyncClient
) -> Optional[dict]:
    """Return the existing interaction row or None."""
    result = (
        await db.table(_INTERACTIONS_TABLE)
        .select("*")
        .eq("post_id", post_id)
        .eq("user_id", user_id)
        .eq("interaction_type", interaction_type)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


async def _handle_tried_it(
    user_id: str,
    post_id: str,
    existing: Optional[dict],
    macro_confirmation: Optional[dict],
    post: CommunityPostResponse,
    db: AsyncClient,
) -> InteractionResult:
    """Insert a tried_it interaction (write-once) and check community_verified."""
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "Already tried",
                "code": "TRIED_IT_DUPLICATE",
                "detail": "You have already marked this recipe as tried.",
            },
        )

    payload: dict = {
        "post_id": post_id,
        "user_id": user_id,
        "interaction_type": "tried_it",
    }
    if macro_confirmation:
        payload["macro_confirmation"] = macro_confirmation

    await db.table(_INTERACTIONS_TABLE).insert(payload).execute()

    # Check if community_verified threshold is met
    verified = await _check_community_verified(post_id, post.condition_tags, db)
    if verified and not post.community_verified:
        await db.table(_POSTS_TABLE).update(
            {"community_verified": True}
        ).eq("id", post_id).execute()

    return InteractionResult(
        interaction_type="tried_it",
        active=True,
        community_verified=verified or post.community_verified,
    )


async def _handle_toggle(
    user_id: str,
    post_id: str,
    interaction_type: str,
    existing: Optional[dict],
    post: CommunityPostResponse,
    db: AsyncClient,
) -> InteractionResult:
    """Toggle an upvote or bookmark on or off."""
    if existing:
        # Toggle off — delete and decrement
        await db.table(_INTERACTIONS_TABLE).delete().eq("id", existing["id"]).execute()
        updated_post = await _decrement_counter(post_id, interaction_type, db)
        return InteractionResult(
            interaction_type=interaction_type,
            active=False,
            post_upvotes=updated_post.get("upvotes"),
            post_bookmarks=updated_post.get("bookmarks"),
        )
    else:
        # Toggle on — insert and increment
        await db.table(_INTERACTIONS_TABLE).insert(
            {"post_id": post_id, "user_id": user_id, "interaction_type": interaction_type}
        ).execute()
        updated_post = await _increment_counter(post_id, interaction_type, db)
        return InteractionResult(
            interaction_type=interaction_type,
            active=True,
            post_upvotes=updated_post.get("upvotes"),
            post_bookmarks=updated_post.get("bookmarks"),
        )


async def _increment_counter(post_id: str, interaction_type: str, db: AsyncClient) -> dict:
    """Increment the relevant counter column on the post and return updated row."""
    col = "upvotes" if interaction_type == "upvote" else "bookmarks"
    result = (
        await db.rpc(
            "increment_post_counter",
            {"p_post_id": post_id, "p_column": col, "p_delta": 1},
        ).execute()
    )
    # Fallback: re-fetch post for the updated counter values
    post_result = (
        await db.table(_POSTS_TABLE).select("upvotes, bookmarks").eq("id", post_id).single().execute()
    )
    return post_result.data or {}


async def _decrement_counter(post_id: str, interaction_type: str, db: AsyncClient) -> dict:
    """Decrement the relevant counter column on the post and return updated row."""
    col = "upvotes" if interaction_type == "upvote" else "bookmarks"
    await db.rpc(
        "increment_post_counter",
        {"p_post_id": post_id, "p_column": col, "p_delta": -1},
    ).execute()
    post_result = (
        await db.table(_POSTS_TABLE).select("upvotes, bookmarks").eq("id", post_id).single().execute()
    )
    return post_result.data or {}


async def _check_community_verified(
    post_id: str, condition_tags: list[str], db: AsyncClient
) -> bool:
    """Return True if ≥ 5 users who share at least one of the post's condition_tags
    have submitted a tried_it interaction.

    Condition matching is done by joining interactions → user_profiles and checking
    that the user's health_conditions array overlaps with the post's condition_tags.
    """
    if not condition_tags:
        return False

    # Fetch all tried_it user_ids for this post
    result = (
        await db.table(_INTERACTIONS_TABLE)
        .select("user_id")
        .eq("post_id", post_id)
        .eq("interaction_type", "tried_it")
        .execute()
    )
    tried_user_ids = [r["user_id"] for r in (result.data or [])]
    if len(tried_user_ids) < _VERIFIED_THRESHOLD:
        return False

    # Count how many of those users share at least one condition_tag
    matching_count = 0
    for uid in tried_user_ids:
        profile_result = (
            await db.table("user_profiles")
            .select("health_conditions")
            .eq("user_id", uid)
            .single()
            .execute()
        )
        if not profile_result.data:
            continue
        user_conditions = set(profile_result.data.get("health_conditions") or [])
        if user_conditions.intersection(condition_tags):
            matching_count += 1

    return matching_count >= _VERIFIED_THRESHOLD


def _build_comment_tree(rows: list[dict]) -> list[CommentResponse]:
    """Build a nested comment tree from a flat list of rows.

    Top-level comments (parent_comment_id is None) are returned at the root;
    replies are nested inside their parent's ``replies`` list.
    """
    by_id: dict[str, CommentResponse] = {}
    for row in rows:
        by_id[row["id"]] = _comment_row_to_response(row)

    roots: list[CommentResponse] = []
    for row in rows:
        comment = by_id[row["id"]]
        parent_id = row.get("parent_comment_id")
        if parent_id and parent_id in by_id:
            by_id[parent_id].replies.append(comment)
        else:
            roots.append(comment)

    return roots


def _extract_single(result, operation: str) -> dict:
    """Pull the first row from a Supabase result or raise 500."""
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": f"Database operation failed: {operation}",
                "code": "DB_ERROR",
                "detail": "No data returned from Supabase.",
            },
        )
    data = result.data
    return data[0] if isinstance(data, list) else data


def _post_row_to_response(row: dict) -> CommunityPostResponse:
    """Map a raw community_posts row to a ``CommunityPostResponse``."""
    recipe_raw = row.get("adapted_recipe")
    recipe = AdaptedRecipe(**recipe_raw) if recipe_raw else None
    return CommunityPostResponse(
        id=str(row["id"]),
        author_id=str(row["author_id"]),
        title=row["title"],
        body=row["body"],
        adapted_recipe=recipe,
        condition_tags=row.get("condition_tags") or [],
        cuisine_tag=row.get("cuisine_tag"),
        upvotes=row.get("upvotes", 0),
        bookmarks=row.get("bookmarks", 0),
        community_verified=row.get("community_verified", False),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _comment_row_to_response(row: dict) -> CommentResponse:
    """Map a raw post_comments row to a ``CommentResponse``."""
    return CommentResponse(
        id=str(row["id"]),
        post_id=str(row["post_id"]),
        author_id=str(row["author_id"]),
        body=row["body"],
        parent_comment_id=row.get("parent_comment_id"),
        replies=[],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
