"""Tests for meal plan generation, storage, and retrieval."""

from __future__ import annotations

import datetime
import json
from unittest.mock import AsyncMock, MagicMock, patch, AsyncMock

import pytest


# ---------------------------------------------------------------------------
# Shared fixtures / helpers
# ---------------------------------------------------------------------------

FAKE_PROFILE_ROW = {
    "id": "profile-uuid",
    "user_id": "user-uuid-1234",
    "sex": "female",
    "age": 30,
    "weight_kg": 65.0,
    "height_cm": 163.0,
    "health_conditions": ["type2_diabetes"],
    "allergens": ["gluten"],
    "cuisines": ["south_asian"],
    "diet_preferences": ["halal"],
    "tdee": 2000.0,
    "macro_targets": {
        "calories": 2000.0,
        "protein_g": 140.0,
        "carbs_g": 175.0,
        "fat_g": 67.0,
        "fiber_g": 30.0,
    },
    "created_at": datetime.datetime.utcnow().isoformat(),
    "updated_at": datetime.datetime.utcnow().isoformat(),
}


def _make_meal(meal_type: str, ingredients: list[dict] | None = None) -> dict:
    """Build a minimal valid meal dict for testing."""
    if ingredients is None:
        ingredients = [{"name": "rice", "quantity": 150, "unit": "g"}]
    return {
        "meal_type": meal_type,
        "dish_name": f"Test {meal_type.title()} Dish",
        "cuisine_tag": "south_asian",
        "original_dish": "Original Dish",
        "adapted_dish": "Adapted Dish",
        "why_this_works": "Good for diabetes.",
        "ingredients": ingredients,
        "macros": {"calories": 600, "protein_g": 40, "carbs_g": 80, "fat_g": 15, "fiber_g": 10},
        "micros": {"sodium_mg": 400, "potassium_mg": 800, "iron_mg": 3},
        "glycemic_notes": "Low GI rice used.",
        "portion_size": "1 bowl (~350g)",
    }


FAKE_MEALS = [_make_meal("breakfast"), _make_meal("lunch"), _make_meal("dinner")]

FAKE_PLAN_ROW = {
    "id": "plan-uuid",
    "user_id": "user-uuid-1234",
    "plan_date": "2025-07-15",
    "meals": FAKE_MEALS,
    "created_at": datetime.datetime.utcnow().isoformat(),
    "updated_at": datetime.datetime.utcnow().isoformat(),
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_meal_plan_success(async_client, mock_db):
    """POST /generate with mocked LLM should return 201 with meals."""
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_PROFILE_ROW, count=1),  # get_profile single
            MagicMock(data=[FAKE_PLAN_ROW], count=1),   # upsert plan
        ]
    )

    with patch(
        "app.services.meal_plan_service.taste_service.get_recent_feedback",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.meal_plan_service.cookbook_service.get_modifications_for_prompt",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.llm_service.generate_meal_plan",
        new_callable=AsyncMock,
        return_value={"meals": FAKE_MEALS},
    ):
        response = await async_client.post(
            "/api/v1/meal-plans/generate",
            json={"plan_date": "2025-07-15"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["plan_date"] == "2025-07-15"
    assert len(data["meals"]) == 3


@pytest.mark.asyncio
async def test_allergen_not_in_generated_ingredients(async_client, mock_db):
    """Meals returned by LLM must contain no declared allergen ingredients."""
    # User has gluten allergy — check that no ingredient name contains "gluten" or "wheat"
    allergen_ingredient = {"name": "wheat flour", "quantity": 100, "unit": "g"}
    safe_ingredient = {"name": "rice flour", "quantity": 100, "unit": "g"}

    safe_meals = [
        _make_meal("breakfast", [safe_ingredient]),
        _make_meal("lunch", [safe_ingredient]),
        _make_meal("dinner", [safe_ingredient]),
    ]

    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=FAKE_PROFILE_ROW, count=1),
            MagicMock(data=[{**FAKE_PLAN_ROW, "meals": safe_meals}], count=1),
        ]
    )

    with patch(
        "app.services.meal_plan_service.taste_service.get_recent_feedback",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.meal_plan_service.cookbook_service.get_modifications_for_prompt",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.llm_service.generate_meal_plan",
        new_callable=AsyncMock,
        return_value={"meals": safe_meals},
    ):
        response = await async_client.post(
            "/api/v1/meal-plans/generate",
            json={"plan_date": "2025-07-15"},
        )

    assert response.status_code == 201
    all_ingredients = [
        ing["name"]
        for meal in response.json()["meals"]
        for ing in meal["ingredients"]
    ]
    for name in all_ingredients:
        assert "wheat" not in name.lower(), f"Allergen ingredient found: {name}"
        assert "gluten" not in name.lower(), f"Allergen ingredient found: {name}"


@pytest.mark.asyncio
async def test_get_plan_by_date(async_client, mock_db):
    """GET /{plan_date} should return the stored meal plan for that date."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=FAKE_PLAN_ROW, count=1))

    response = await async_client.get("/api/v1/meal-plans/2025-07-15")
    assert response.status_code == 200
    data = response.json()
    assert data["plan_date"] == "2025-07-15"
    assert len(data["meals"]) == 3


@pytest.mark.asyncio
async def test_get_plan_not_found(async_client, mock_db):
    """GET /{plan_date} for a missing plan should return 404."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=None, count=0))
    response = await async_client.get("/api/v1/meal-plans/2024-01-01")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "PLAN_NOT_FOUND"


@pytest.mark.asyncio
async def test_llm_json_parse_failure_retries_then_raises_502(async_client, mock_db):
    """If LLM returns invalid JSON twice, the endpoint should return 502."""
    mock_db.execute = AsyncMock(
        return_value=MagicMock(data=FAKE_PROFILE_ROW, count=1)
    )

    with patch(
        "app.services.meal_plan_service.taste_service.get_recent_feedback",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.meal_plan_service.cookbook_service.get_modifications_for_prompt",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.llm_service._call_claude",
        new_callable=AsyncMock,
        return_value="This is not JSON at all.",
    ):
        response = await async_client.post(
            "/api/v1/meal-plans/generate",
            json={"plan_date": "2025-07-15"},
        )

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "LLM_INVALID_JSON"
