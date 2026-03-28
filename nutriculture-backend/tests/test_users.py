"""Tests for user profile endpoints and macro calculation logic."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.utils.macro_calculator import (
    calculate_bmr,
    calculate_tdee,
    calculate_macro_targets,
)
from app.constants.conditions import HealthCondition


# ---------------------------------------------------------------------------
# Unit: macro calculator
# ---------------------------------------------------------------------------


def test_bmr_male():
    """Male BMR should be female BMR + 166 kcal (Mifflin-St Jeor offset)."""
    male = calculate_bmr("male", 30, 80, 175)
    female = calculate_bmr("female", 30, 80, 175)
    assert abs(male - female - 166) < 1e-6


def test_bmr_female():
    """Female BMR result should be within a known expected range."""
    bmr = calculate_bmr("female", 35, 70, 165)
    # Mifflin-St Jeor: (10*70) + (6.25*165) - (5*35) - 161 = 1395.25
    assert abs(bmr - 1395.25) < 0.01


def test_tdee_invalid_activity_level():
    """Unknown activity level must raise ValueError."""
    with pytest.raises(ValueError, match="Unknown activity level"):
        calculate_tdee(1500.0, "olympic_athlete")


def test_macro_targets_type2_diabetes():
    """Type2Diabetes profile: carbs ≤ 40 %, fiber ≥ 30 g."""
    targets = calculate_macro_targets(2000.0, [HealthCondition.Type2Diabetes], 75)
    carbs_pct = (targets["carbs_g"] * 4) / targets["calories"]
    assert carbs_pct <= 0.40, f"Carbs {carbs_pct:.1%} exceeds 40%"
    assert targets["fiber_g"] >= 30.0, f"Fiber {targets['fiber_g']}g below 30g"


def test_macro_targets_kidney_disease_protein_cap():
    """KidneyDisease: protein must not exceed 0.8 g/kg body weight."""
    weight_kg = 70.0
    targets = calculate_macro_targets(2000.0, [HealthCondition.KidneyDisease], weight_kg)
    max_protein = 0.8 * weight_kg
    assert targets["protein_g"] <= max_protein, (
        f"Protein {targets['protein_g']}g exceeds cap {max_protein}g"
    )


def test_macro_targets_hypertension_advisories():
    """Hypertension profile: sodium_mg_max and potassium_mg_min must be set."""
    targets = calculate_macro_targets(2000.0, [HealthCondition.Hypertension], 70)
    assert targets.get("sodium_mg_max") == 1500.0
    assert targets.get("potassium_mg_min") == 3500.0


def test_macro_targets_no_conditions_sums_to_100pct():
    """Baseline (no conditions): protein + carbs kcal + fat kcal ≈ total calories."""
    targets = calculate_macro_targets(2000.0, [], 70)
    reconstructed = (
        targets["protein_g"] * 4 + targets["carbs_g"] * 4 + targets["fat_g"] * 9
    )
    assert abs(reconstructed - 2000.0) < 20, f"Macro sum {reconstructed} too far from 2000"


# ---------------------------------------------------------------------------
# Integration: profile endpoints
# ---------------------------------------------------------------------------


VALID_PROFILE_PAYLOAD = {
    "sex": "female",
    "age": 30,
    "weight_kg": 65.0,
    "height_cm": 163.0,
    "activity_level": "moderately_active",
    "health_conditions": ["type2_diabetes"],
    "allergens": ["gluten"],
    "cuisines": ["south_asian", "west_african"],
    "diet_preferences": ["halal"],
}


@pytest.mark.asyncio
async def test_upsert_profile_valid(async_client, mock_db):
    """PUT /profile with valid data should return 200 and the profile."""
    import datetime

    fake_row = {
        "id": "row-uuid",
        "user_id": "user-uuid-1234",
        "sex": "female",
        "age": 30,
        "weight_kg": 65.0,
        "height_cm": 163.0,
        "health_conditions": ["type2_diabetes"],
        "allergens": ["gluten"],
        "cuisines": ["south_asian", "west_african"],
        "diet_preferences": ["halal"],
        "tdee": 2100.0,
        "macro_targets": {
            "calories": 2100.0,
            "protein_g": 150.0,
            "carbs_g": 180.0,
            "fat_g": 70.0,
            "fiber_g": 30.0,
        },
        "created_at": datetime.datetime.utcnow().isoformat(),
        "updated_at": datetime.datetime.utcnow().isoformat(),
    }
    mock_db.execute = AsyncMock(return_value=MagicMock(data=[fake_row], count=1))

    response = await async_client.put(
        "/api/v1/users/profile",
        json=VALID_PROFILE_PAYLOAD,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "user-uuid-1234"
    assert data["sex"] == "female"


@pytest.mark.asyncio
async def test_upsert_profile_too_many_cuisines(async_client):
    """PUT /profile with > 3 cuisines should return 422."""
    payload = {**VALID_PROFILE_PAYLOAD, "cuisines": ["south_asian", "west_african", "east_asian", "caribbean"]}
    response = await async_client.put("/api/v1/users/profile", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_profile_not_found(async_client, mock_db):
    """GET /profile when no profile exists should return 404."""
    mock_db.execute = AsyncMock(return_value=MagicMock(data=None, count=0))
    response = await async_client.get("/api/v1/users/profile")
    assert response.status_code == 404
    # FastAPI wraps HTTPException.detail inside {"detail": ...}
    assert response.json()["detail"]["code"] == "PROFILE_NOT_FOUND"
