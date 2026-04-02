"""Pydantic models for taste learning feedback endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.constants.meal_feedback import FeedbackAction
from app.models.meal_plan import MealMacros


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class SubmitFeedbackRequest(BaseModel):
    """Payload for POST /api/v1/taste/feedback."""

    plan_date: str = Field(..., description="ISO-8601 date of the plan e.g. 2025-07-15")
    meal_type: str = Field(
        ...,
        pattern="^(breakfast|lunch|dinner|suhoor|iftar|light_snack)$",
    )
    dish_name: str
    cuisine_tag: Optional[str] = None
    action: FeedbackAction
    modification_notes: Optional[str] = Field(
        None,
        description="Free-text description of changes made (required when action=modified)",
    )
    modified_macros: Optional[MealMacros] = Field(
        None,
        description="User-estimated macros after their modifications",
    )


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class FeedbackResponse(BaseModel):
    """Single feedback record returned after submission."""

    id: str
    user_id: str
    plan_date: str
    meal_type: str
    dish_name: str
    cuisine_tag: Optional[str]
    action: str
    modification_notes: Optional[str]
    created_at: datetime


class TastePreferenceSummary(BaseModel):
    """Claude-generated natural language summary of inferred taste preferences."""

    summary: str
    """Natural language summary of the user's inferred preferences and patterns."""

    inferred_sub_cuisines: list[str]
    """Sub-cuisines inferred from saved/skipped patterns (e.g. 'punjabi', 'tamil')."""

    avoided_ingredients: list[str]
    """Ingredients that appear frequently in skipped meals."""

    preferred_cooking_styles: list[str]
    """Cooking styles or flavour profiles the user gravitates toward."""

    feedback_count: int
    """Number of feedback entries used to generate this summary."""
