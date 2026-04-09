"""Tests for cookbook CRUD endpoints."""

from __future__ import annotations

import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest


FAKE_MACROS = {"calories": 600.0, "protein_g": 35.0, "carbs_g": 70.0, "fat_g": 15.0, "fiber_g": 8.0}
FAKE_MICROS = {"sodium_mg": 300.0, "potassium_mg": 500.0, "iron_mg": 4.0}
FAKE_INGREDIENTS = [{"name": "lentils", "quantity": 200, "unit": "g"}]

FAKE_COOKBOOK_ROW = {
    "id": "entry-uuid",
    "user_id": "user-uuid-1234",
    "dish_name": "Red Lentil Soup",
    "meal_type": "lunch",
    "cuisine_tag": "middle_eastern",
    "source_plan_date": "2025-07-15",
    "ingredients": FAKE_INGREDIENTS,
    "macros": FAKE_MACROS,
    "micros": FAKE_MICROS,
    "user_modifications": None,
    "adjusted_macros": None,
    "created_at": datetime.datetime.utcnow().isoformat(),
    "updated_at": datetime.datetime.utcnow().isoformat(),
}


# ---------------------------------------------------------------------------
# POST /api/v1/cookbook
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_save_entry(async_client, mock_db):
    """Saving a recipe should insert a row and return 201."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[FAKE_COOKBOOK_ROW]))

    response = await async_client.post(
        "/api/v1/cookbook",
        json={
            "dish_name": "Red Lentil Soup",
            "meal_type": "lunch",
            "cuisine_tag": "middle_eastern",
            "source_plan_date": "2025-07-15",
            "ingredients": FAKE_INGREDIENTS,
            "macros": FAKE_MACROS,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["dish_name"] == "Red Lentil Soup"
    assert data["meal_type"] == "lunch"


# ---------------------------------------------------------------------------
# GET /api/v1/cookbook
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_entries(async_client, mock_db):
    """Listing cookbook entries should return entries and total count."""
    mock_db.execute = AsyncMock(
        return_value=MagicMock(data=[FAKE_COOKBOOK_ROW], count=1)
    )

    response = await async_client.get("/api/v1/cookbook")

    assert response.status_code == 200
    data = response.json()
    assert len(data["entries"]) == 1
    assert data["total"] == 1
    assert data["entries"][0]["dish_name"] == "Red Lentil Soup"


@pytest.mark.asyncio
async def test_list_entries_empty(async_client, mock_db):
    """Listing with no saved entries should return an empty list."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[], count=0))

    response = await async_client.get("/api/v1/cookbook")

    assert response.status_code == 200
    data = response.json()
    assert data["entries"] == []
    assert data["total"] == 0


# ---------------------------------------------------------------------------
# GET /api/v1/cookbook/{entry_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_entry_success(async_client, mock_db):
    """Fetching an existing entry by ID should return it."""
    mock_db.execute = AsyncMock(
        return_value=MagicMock(data=FAKE_COOKBOOK_ROW)
    )

    response = await async_client.get("/api/v1/cookbook/entry-uuid")

    assert response.status_code == 200
    assert response.json()["id"] == "entry-uuid"


@pytest.mark.asyncio
async def test_get_entry_not_found(async_client, mock_db):
    """Fetching a non-existent entry should return 404."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=None))

    response = await async_client.get("/api/v1/cookbook/does-not-exist")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "COOKBOOK_ENTRY_NOT_FOUND"


# ---------------------------------------------------------------------------
# PATCH /api/v1/cookbook/{entry_id}/modify
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_modify_entry(async_client, mock_db):
    """Patching an entry with modification notes should return the updated row."""
    updated_row = {**FAKE_COOKBOOK_ROW, "user_modifications": "Always reduce oil by half"}
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_COOKBOOK_ROW),   # get_entry ownership check
            MagicMock(data=[updated_row]),         # update
        ]
    )

    response = await async_client.patch(
        "/api/v1/cookbook/entry-uuid/modify",
        json={"user_modifications": "Always reduce oil by half"},
    )

    assert response.status_code == 200
    assert response.json()["user_modifications"] == "Always reduce oil by half"


# ---------------------------------------------------------------------------
# DELETE /api/v1/cookbook/{entry_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_entry(async_client, mock_db):
    """Deleting an entry should return 204 with no content."""
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_COOKBOOK_ROW),  # get_entry ownership check
            MagicMock(data=[]),                  # delete
        ]
    )

    response = await async_client.delete("/api/v1/cookbook/entry-uuid")

    assert response.status_code == 204
    assert response.content == b""


@pytest.mark.asyncio
async def test_delete_entry_not_found(async_client, mock_db):
    """Deleting a non-existent entry should return 404."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=None))

    response = await async_client.delete("/api/v1/cookbook/does-not-exist")

    assert response.status_code == 404
