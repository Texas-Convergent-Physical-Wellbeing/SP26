"""Pydantic request/response models for user profile endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.constants.allergens import Allergen
from app.constants.conditions import HealthCondition
from app.constants.cuisines import Cuisine
from app.constants.diets import DietPreference
from app.constants.festive_events import FestiveEvent
from app.constants.skill_levels import SkillLevel

# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class MacroTargets(BaseModel):
    """Computed daily macro targets stored on the user profile."""

    calories: float = Field(..., gt=0)
    protein_g: float = Field(..., ge=0)
    carbs_g: float = Field(..., ge=0)
    fat_g: float = Field(..., ge=0)
    fiber_g: float = Field(..., ge=0)
    # Optional condition-specific advisory fields
    sodium_mg_max: Optional[float] = None
    potassium_mg_min: Optional[float] = None
    potassium_mg_max: Optional[float] = None
    phosphorus_mg_max: Optional[float] = None
    gluten_free: Optional[float] = None


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class UserProfileUpsertRequest(BaseModel):
    """Payload for PUT /api/v1/users/profile."""

    sex: str = Field(..., pattern="^(male|female|other)$")
    age: int = Field(..., gt=0, lt=150)
    weight_kg: float = Field(..., gt=0)
    height_cm: float = Field(..., gt=0)
    activity_level: str = Field(
        "moderately_active",
        pattern="^(sedentary|lightly_active|moderately_active|very_active|extra_active)$",
    )
    health_conditions: list[HealthCondition] = Field(default_factory=list)
    allergens: list[Allergen] = Field(default_factory=list)
    cuisines: list[Cuisine] = Field(default_factory=list)
    diet_preferences: list[DietPreference] = Field(default_factory=list)
    skill_level: SkillLevel = SkillLevel.Intermediate
    shortcut_mode: bool = False

    @field_validator("cuisines")
    @classmethod
    def validate_cuisine_limit(cls, v: list[Cuisine]) -> list[Cuisine]:
        """Enforce a maximum of 3 cuisine preferences."""
        if len(v) > 3:
            raise ValueError("A maximum of 3 cuisine preferences is allowed.")
        return v


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class SetFestiveEventRequest(BaseModel):
    """Payload for PUT /api/v1/users/profile/festive."""

    event: FestiveEvent
    start_date: str = Field(..., description="ISO-8601 date e.g. 2025-03-01")
    end_date: str = Field(..., description="ISO-8601 date e.g. 2025-03-30")


class UserProfileResponse(BaseModel):
    """Full user profile returned from GET /api/v1/users/profile."""

    id: str
    user_id: str
    sex: str
    age: int
    weight_kg: float
    height_cm: float
    health_conditions: list[str]
    allergens: list[str]
    cuisines: list[str]
    diet_preferences: list[str]
    skill_level: str
    shortcut_mode: bool
    active_festive_event: Optional[str]
    festive_event_start: Optional[str]
    festive_event_end: Optional[str]
    tdee: Optional[float]
    macro_targets: Optional[MacroTargets]
    created_at: datetime
    updated_at: datetime


class MacroTargetsResponse(BaseModel):
    """Response for GET /api/v1/users/profile/macros."""

    macro_targets: MacroTargets
    tdee: float
