"""Pydantic request/response models for meal plan endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Sub-models matching the JSONB meals schema
# ---------------------------------------------------------------------------


class Ingredient(BaseModel):
    """A single ingredient entry within a meal."""

    name: str
    quantity: float
    unit: str


class MealMacros(BaseModel):
    """Macro-nutrient breakdown for one meal."""

    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float


class MealMicros(BaseModel):
    """Key micronutrient values for one meal."""

    sodium_mg: float
    potassium_mg: float
    iron_mg: float
    calcium_mg: Optional[float] = None
    vitamin_c_mg: Optional[float] = None


class MealObject(BaseModel):
    """A single meal (breakfast, lunch, or dinner) within a daily plan."""

    meal_type: str = Field(
        ...,
        pattern="^(breakfast|lunch|dinner|suhoor|iftar|light_snack)$",
    )
    dish_name: str
    cuisine_tag: str
    original_dish: str
    adapted_dish: str
    why_this_works: str
    ingredients: list[Ingredient]
    macros: MealMacros
    micros: MealMicros
    glycemic_notes: Optional[str] = None
    portion_size: str


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class GenerateMealPlanRequest(BaseModel):
    """Payload for POST /api/v1/meal-plans/generate."""

    plan_date: date


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class MealPlanResponse(BaseModel):
    """Full meal plan record returned from generation or lookup."""

    id: str
    user_id: str
    plan_date: date
    meals: list[MealObject]
    created_at: datetime
    updated_at: datetime


class MealPlanListResponse(BaseModel):
    """Paginated list of meal plan summaries."""

    plans: list[MealPlanResponse]
    total: int
    limit: int
    offset: int
