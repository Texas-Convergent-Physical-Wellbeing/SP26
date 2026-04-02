"""Tests for taste learning feedback and preference inference endpoints."""

from __future__ import annotations

import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.taste import TastePreferenceSummary


FAKE_FEEDBACK_ROW = {
    "id": "feedback-uuid",
    "user_id": "user-uuid-1234",
    "plan_date": "2025-07-15",
    "meal_type": "dinner",
    "dish_name": "Dal Makhani",
    "cuisine_tag": "south_asian",
    "action": "saved",
    "modification_notes": None,
    "created_at": datetime.datetime.utcnow().isoformat(),
}

FAKE_FEEDBACK_ROW_MODIFIED = {
    **FAKE_FEEDBACK_ROW,
    "id": "feedback-uuid-2",
    "action": "modified",
    "modification_notes": "Reduced oil by half",
}

FAKE_PREFERENCE_SUMMARY = TastePreferenceSummary(
    summary="User prefers South Asian dishes, especially lentil-based recipes.",
    inferred_sub_cuisines=["punjabi", "tamil"],
    avoided_ingredients=["cream"],
    preferred_cooking_styles=["slow-cooked", "spiced"],
    feedback_count=5,
)


# ---------------------------------------------------------------------------
# POST /api/v1/taste/feedback
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_submit_feedback_saved(async_client, mock_db):
    """Saved feedback should insert a row and return 201."""
    mock_db.execute = AsyncMock(
        return_value=MagicMock(data=[FAKE_FEEDBACK_ROW])
    )

    response = await async_client.post(
        "/api/v1/taste/feedback",
        json={
            "plan_date": "2025-07-15",
            "meal_type": "dinner",
            "dish_name": "Dal Makhani",
            "cuisine_tag": "south_asian",
            "action": "saved",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["action"] == "saved"
    assert data["dish_name"] == "Dal Makhani"


@pytest.mark.asyncio
async def test_submit_feedback_modified_with_notes(async_client, mock_db):
    """Modified feedback with notes should succeed and return 201."""
    mock_db.execute = AsyncMock(
        return_value=MagicMock(data=[FAKE_FEEDBACK_ROW_MODIFIED])
    )

    response = await async_client.post(
        "/api/v1/taste/feedback",
        json={
            "plan_date": "2025-07-15",
            "meal_type": "dinner",
            "dish_name": "Dal Makhani",
            "cuisine_tag": "south_asian",
            "action": "modified",
            "modification_notes": "Reduced oil by half",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["action"] == "modified"
    assert data["modification_notes"] == "Reduced oil by half"


@pytest.mark.asyncio
async def test_submit_feedback_modified_without_notes_returns_422(async_client, mock_db):
    """Modified feedback without notes must be rejected with 422."""
    response = await async_client.post(
        "/api/v1/taste/feedback",
        json={
            "plan_date": "2025-07-15",
            "meal_type": "dinner",
            "dish_name": "Dal Makhani",
            "action": "modified",
            # modification_notes intentionally omitted
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "MODIFICATION_NOTES_MISSING"


@pytest.mark.asyncio
async def test_submit_feedback_skipped(async_client, mock_db):
    """Skipped feedback should insert without notes and return 201."""
    skipped_row = {**FAKE_FEEDBACK_ROW, "action": "skipped", "dish_name": "Saag Paneer"}
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[skipped_row]))

    response = await async_client.post(
        "/api/v1/taste/feedback",
        json={
            "plan_date": "2025-07-15",
            "meal_type": "lunch",
            "dish_name": "Saag Paneer",
            "action": "skipped",
        },
    )

    assert response.status_code == 201
    assert response.json()["action"] == "skipped"


# ---------------------------------------------------------------------------
# GET /api/v1/taste/preferences
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_preferences_no_feedback_returns_404(async_client, mock_db):
    """If no feedback exists yet, the endpoint should return 404."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[]))

    response = await async_client.get("/api/v1/taste/preferences")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "NO_FEEDBACK"


@pytest.mark.asyncio
async def test_get_preferences_success(async_client, mock_db):
    """With existing feedback, Claude inference should return a summary."""
    mock_db.execute = AsyncMock(
        return_value=MagicMock(data=[FAKE_FEEDBACK_ROW, FAKE_FEEDBACK_ROW_MODIFIED])
    )

    with patch(
        "app.services.taste_service._infer_preferences_with_claude",
        new_callable=AsyncMock,
        return_value=FAKE_PREFERENCE_SUMMARY,
    ):
        response = await async_client.get("/api/v1/taste/preferences")

    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert data["feedback_count"] == 5
    assert "punjabi" in data["inferred_sub_cuisines"]
