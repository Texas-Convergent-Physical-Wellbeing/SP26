"""Tests for festive mode endpoints and skill level profile fields."""

from __future__ import annotations

import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest


_NOW = datetime.datetime.utcnow().isoformat()

FAKE_PROFILE_ROW = {
    "id": "profile-uuid",
    "user_id": "user-uuid-1234",
    "sex": "female",
    "age": 30,
    "weight_kg": 65.0,
    "height_cm": 163.0,
    "health_conditions": ["type2_diabetes"],
    "allergens": [],
    "cuisines": ["south_asian"],
    "diet_preferences": ["halal"],
    "skill_level": "intermediate",
    "shortcut_mode": False,
    "active_festive_event": None,
    "festive_event_start": None,
    "festive_event_end": None,
    "tdee": 2000.0,
    "macro_targets": {
        "calories": 2000.0,
        "protein_g": 140.0,
        "carbs_g": 175.0,
        "fat_g": 67.0,
        "fiber_g": 30.0,
    },
    "created_at": _NOW,
    "updated_at": _NOW,
}


# ---------------------------------------------------------------------------
# PUT /api/v1/users/profile/festive
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_festive_event_ramadan(async_client, mock_db):
    """Setting Ramadan festive mode should activate it on the profile."""
    ramadan_row = {
        **FAKE_PROFILE_ROW,
        "active_festive_event": "ramadan",
        "festive_event_start": "2025-03-01",
        "festive_event_end": "2025-03-30",
    }
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_PROFILE_ROW),  # get_profile existence check
            MagicMock(data=[ramadan_row]),       # update
        ]
    )

    response = await async_client.put(
        "/api/v1/users/profile/festive",
        json={
            "event": "ramadan",
            "start_date": "2025-03-01",
            "end_date": "2025-03-30",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["active_festive_event"] == "ramadan"
    assert data["festive_event_start"] == "2025-03-01"
    assert data["festive_event_end"] == "2025-03-30"


@pytest.mark.asyncio
async def test_set_festive_event_diwali(async_client, mock_db):
    """Setting Diwali festive mode should work for non-Ramadan events."""
    diwali_row = {
        **FAKE_PROFILE_ROW,
        "active_festive_event": "diwali",
        "festive_event_start": "2025-10-20",
        "festive_event_end": "2025-10-24",
    }
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_PROFILE_ROW),
            MagicMock(data=[diwali_row]),
        ]
    )

    response = await async_client.put(
        "/api/v1/users/profile/festive",
        json={
            "event": "diwali",
            "start_date": "2025-10-20",
            "end_date": "2025-10-24",
        },
    )

    assert response.status_code == 200
    assert response.json()["active_festive_event"] == "diwali"


@pytest.mark.asyncio
async def test_set_festive_event_no_profile_returns_404(async_client, mock_db):
    """Setting festive mode without a profile should return 404."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=None))

    response = await async_client.put(
        "/api/v1/users/profile/festive",
        json={
            "event": "ramadan",
            "start_date": "2025-03-01",
            "end_date": "2025-03-30",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "PROFILE_NOT_FOUND"


# ---------------------------------------------------------------------------
# DELETE /api/v1/users/profile/festive
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_clear_festive_event(async_client, mock_db):
    """Clearing festive mode should null out the festive fields."""
    cleared_row = {
        **FAKE_PROFILE_ROW,
        "active_festive_event": None,
        "festive_event_start": None,
        "festive_event_end": None,
    }
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data={**FAKE_PROFILE_ROW, "active_festive_event": "ramadan"}),
            MagicMock(data=[cleared_row]),
        ]
    )

    response = await async_client.delete("/api/v1/users/profile/festive")

    assert response.status_code == 200
    data = response.json()
    assert data["active_festive_event"] is None
    assert data["festive_event_start"] is None


# ---------------------------------------------------------------------------
# Skill level — profile upsert
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upsert_profile_with_skill_level(async_client, mock_db):
    """Upserting a profile with skill_level=beginner should store and return it."""
    beginner_row = {**FAKE_PROFILE_ROW, "skill_level": "beginner", "shortcut_mode": True}
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[beginner_row]))

    response = await async_client.put(
        "/api/v1/users/profile",
        json={
            "sex": "female",
            "age": 30,
            "weight_kg": 65.0,
            "height_cm": 163.0,
            "activity_level": "moderately_active",
            "health_conditions": ["type2_diabetes"],
            "allergens": [],
            "cuisines": ["south_asian"],
            "diet_preferences": ["halal"],
            "skill_level": "beginner",
            "shortcut_mode": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["skill_level"] == "beginner"
    assert data["shortcut_mode"] is True


@pytest.mark.asyncio
async def test_upsert_profile_default_skill_level(async_client, mock_db):
    """Profile upsert without explicit skill_level should default to intermediate."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[FAKE_PROFILE_ROW]))

    response = await async_client.put(
        "/api/v1/users/profile",
        json={
            "sex": "female",
            "age": 30,
            "weight_kg": 65.0,
            "height_cm": 163.0,
            "activity_level": "moderately_active",
            "health_conditions": ["type2_diabetes"],
            "allergens": [],
            "cuisines": ["south_asian"],
            "diet_preferences": ["halal"],
        },
    )

    assert response.status_code == 200
    assert response.json()["skill_level"] == "intermediate"
