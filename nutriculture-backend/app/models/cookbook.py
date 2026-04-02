"""Pydantic models for cookbook endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.meal_plan import Ingredient, MealMacros, MealMicros


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class SaveCookbookEntryRequest(BaseModel):
    """Payload for POST /api/v1/cookbook — save a recipe from a plan."""

    dish_name: str
    meal_type: str = Field(
        ...,
        pattern="^(breakfast|lunch|dinner|suhoor|iftar|light_snack)$",
    )
    cuisine_tag: Optional[str] = None
    source_plan_date: Optional[str] = Field(
        None,
        description="ISO-8601 date of the plan this recipe came from",
    )
    ingredients: list[Ingredient]
    macros: MealMacros
    micros: Optional[MealMicros] = None


class ModifyCookbookEntryRequest(BaseModel):
    """Payload for PATCH /api/v1/cookbook/{entry_id}/modify."""

    user_modifications: str = Field(
        ...,
        min_length=1,
        description="Free-text description of personal changes to the recipe",
    )
    adjusted_macros: Optional[MealMacros] = Field(
        None,
        description="Recalculated macros after modifications (optional)",
    )


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class CookbookEntryResponse(BaseModel):
    """Full cookbook entry record."""

    id: str
    user_id: str
    dish_name: str
    meal_type: str
    cuisine_tag: Optional[str]
    source_plan_date: Optional[str]
    ingredients: list[Ingredient]
    macros: MealMacros
    micros: Optional[MealMicros]
    user_modifications: Optional[str]
    adjusted_macros: Optional[MealMacros]
    created_at: datetime
    updated_at: datetime


class CookbookListResponse(BaseModel):
    """Paginated cookbook entry list."""

    entries: list[CookbookEntryResponse]
    total: int
    limit: int
    offset: int
