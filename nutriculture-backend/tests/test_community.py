"""Tests for community posts, interactions, and comments."""

from __future__ import annotations

import datetime
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest


# ---------------------------------------------------------------------------
# Shared fixtures / helpers
# ---------------------------------------------------------------------------

NOW = datetime.datetime.utcnow().isoformat()

FAKE_POST_ROW = {
    "id": "post-uuid-1",
    "author_id": "user-uuid-1234",
    "title": "My Adapted Jollof Rice",
    "body": "Here is how I made it diabetes-friendly.",
    "adapted_recipe": None,
    "condition_tags": ["type2_diabetes"],
    "cuisine_tag": "west_african",
    "upvotes": 0,
    "bookmarks": 0,
    "community_verified": False,
    "created_at": NOW,
    "updated_at": NOW,
}

FAKE_INTERACTION_ROW = {
    "id": "interaction-uuid-1",
    "post_id": "post-uuid-1",
    "user_id": "user-uuid-1234",
    "interaction_type": "upvote",
    "macro_confirmation": None,
    "created_at": NOW,
}

FAKE_COMMENT_ROW = {
    "id": "comment-uuid-1",
    "post_id": "post-uuid-1",
    "author_id": "user-uuid-1234",
    "body": "This is a great recipe!",
    "parent_comment_id": None,
    "created_at": NOW,
    "updated_at": NOW,
}

FAKE_REPLY_ROW = {
    "id": "comment-uuid-2",
    "post_id": "post-uuid-1",
    "author_id": "user-uuid-5678",
    "body": "I agree!",
    "parent_comment_id": "comment-uuid-1",
    "created_at": NOW,
    "updated_at": NOW,
}


CREATE_POST_PAYLOAD = {
    "title": "My Adapted Jollof Rice",
    "body": "Here is how I made it diabetes-friendly and still delicious.",
    "adapted_recipe": None,
    "condition_tags": ["type2_diabetes"],
    "cuisine_tag": "west_african",
}


# ---------------------------------------------------------------------------
# Post CRUD tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_post(async_client, mock_db):
    """POST /posts should return 201 and the created post."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[FAKE_POST_ROW], count=1))

    response = await async_client.post("/api/v1/community/posts", json=CREATE_POST_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "My Adapted Jollof Rice"
    assert data["author_id"] == "user-uuid-1234"


# ---------------------------------------------------------------------------
# Interaction toggle tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upvote_toggle_on(async_client, mock_db):
    """First upvote call should create interaction (active=True)."""
    updated_post = {**FAKE_POST_ROW, "upvotes": 1}
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_POST_ROW, count=1),           # get_post
            MagicMock(data=[], count=0),                       # find existing interaction → none
            MagicMock(data=None),                              # insert interaction
            MagicMock(data=None),                              # rpc increment
            MagicMock(data=updated_post, count=1),             # re-fetch post counters
        ]
    )

    response = await async_client.post(
        "/api/v1/community/posts/post-uuid-1/interact",
        json={"type": "upvote"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["interaction_type"] == "upvote"
    assert data["active"] is True


@pytest.mark.asyncio
async def test_upvote_toggle_off(async_client, mock_db):
    """Second upvote call should remove interaction (active=False)."""
    updated_post = {**FAKE_POST_ROW, "upvotes": 0}
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_POST_ROW, count=1),            # get_post
            MagicMock(data=[FAKE_INTERACTION_ROW], count=1),   # find existing → found
            MagicMock(data=None),                              # delete interaction
            MagicMock(data=None),                              # rpc decrement
            MagicMock(data=updated_post, count=1),             # re-fetch post
        ]
    )

    response = await async_client.post(
        "/api/v1/community/posts/post-uuid-1/interact",
        json={"type": "upvote"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["active"] is False


# ---------------------------------------------------------------------------
# tried_it tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tried_it_does_not_toggle_second_returns_409(async_client, mock_db):
    """Second tried_it call must return 409 Conflict."""
    tried_it_row = {**FAKE_INTERACTION_ROW, "interaction_type": "tried_it"}
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_POST_ROW, count=1),           # get_post
            MagicMock(data=[tried_it_row], count=1),          # find existing → already exists
        ]
    )

    response = await async_client.post(
        "/api/v1/community/posts/post-uuid-1/interact",
        json={"type": "tried_it"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "TRIED_IT_DUPLICATE"


@pytest.mark.asyncio
async def test_community_verified_triggers_at_5_same_condition_confirmations(
    async_client, mock_db
):
    """community_verified must be set when ≥ 5 same-condition tried_it users exist."""
    # Simulated post with condition_tags = ["type2_diabetes"]
    unverified_post = {**FAKE_POST_ROW, "community_verified": False}

    # 5 users who all have type2_diabetes tried it (including current user)
    tried_user_ids = [f"user-{i}" for i in range(1, 6)]
    tried_rows = [
        {"user_id": uid} for uid in tried_user_ids
    ]
    # Each profile query returns a user with type2_diabetes
    profile_rows = [
        MagicMock(data={"health_conditions": ["type2_diabetes"]}, count=1)
        for _ in tried_user_ids
    ]

    call_sequence = [
        MagicMock(data=unverified_post, count=1),   # get_post
        MagicMock(data=[], count=0),                # find existing tried_it → none
        MagicMock(data=None),                       # insert tried_it
        MagicMock(data=tried_rows, count=5),        # fetch all tried_it user_ids
    ] + profile_rows + [
        MagicMock(data=None),                       # update community_verified = True
    ]

    mock_db.execute = AsyncMock(side_effect=call_sequence)

    response = await async_client.post(
        "/api/v1/community/posts/post-uuid-1/interact",
        json={"type": "tried_it"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["community_verified"] is True


# ---------------------------------------------------------------------------
# Comment threading tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_comment(async_client, mock_db):
    """POST /comments should return 201 and the created comment."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[FAKE_COMMENT_ROW], count=1))

    response = await async_client.post(
        "/api/v1/community/posts/post-uuid-1/comments",
        json={"body": "This is a great recipe!"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["body"] == "This is a great recipe!"
    assert data["parent_comment_id"] is None


@pytest.mark.asyncio
async def test_comment_threading_reply_nested_under_parent(async_client, mock_db):
    """GET /comments should return parent comments with replies nested inside."""
    mock_db.execute = AsyncMock(
        return_value=MagicMock(
            data=[FAKE_COMMENT_ROW, FAKE_REPLY_ROW], count=2
        )
    )

    response = await async_client.get("/api/v1/community/posts/post-uuid-1/comments")
    assert response.status_code == 200
    data = response.json()

    # Should have exactly 1 top-level comment
    assert len(data) == 1, f"Expected 1 top-level comment, got {len(data)}"

    top = data[0]
    assert top["id"] == "comment-uuid-1"
    assert len(top["replies"]) == 1
    assert top["replies"][0]["id"] == "comment-uuid-2"
    assert top["replies"][0]["parent_comment_id"] == "comment-uuid-1"
