"""Pydantic request/response models for community endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.models.meal_plan import MealMacros, MealMicros, Ingredient

# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class AdaptedRecipe(BaseModel):
    """A single adapted meal recipe attached to a community post."""

    meal_type: str = Field(..., pattern="^(breakfast|lunch|dinner)$")
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


class CommentResponse(BaseModel):
    """A single comment, optionally containing nested replies."""

    id: str
    post_id: str
    author_id: str
    body: str
    parent_comment_id: Optional[str] = None
    replies: list["CommentResponse"] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# Needed for self-referential model
CommentResponse.model_rebuild()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class CreatePostRequest(BaseModel):
    """Payload for POST /api/v1/community/posts."""

    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=10)
    adapted_recipe: Optional[AdaptedRecipe] = None
    condition_tags: list[str] = Field(default_factory=list)
    cuisine_tag: Optional[str] = None


class InteractRequest(BaseModel):
    """Payload for POST /api/v1/community/posts/{id}/interact."""

    type: Literal["upvote", "bookmark", "tried_it"]
    macro_confirmation: Optional[MealMacros] = None


class AddCommentRequest(BaseModel):
    """Payload for POST /api/v1/community/posts/{id}/comments."""

    body: str = Field(..., min_length=1, max_length=1000)
    parent_comment_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class CommunityPostResponse(BaseModel):
    """Full community post including metadata."""

    id: str
    author_id: str
    title: str
    body: str
    adapted_recipe: Optional[AdaptedRecipe] = None
    condition_tags: list[str]
    cuisine_tag: Optional[str]
    upvotes: int
    bookmarks: int
    community_verified: bool
    created_at: datetime
    updated_at: datetime


class CommunityPostListResponse(BaseModel):
    """Paginated community post list."""

    posts: list[CommunityPostResponse]
    total: int
    limit: int
    offset: int


class InteractionResult(BaseModel):
    """Outcome of a toggle interaction call."""

    interaction_type: str
    active: bool
    post_upvotes: Optional[int] = None
    post_bookmarks: Optional[int] = None
    community_verified: Optional[bool] = None


class DeleteInteractionResult(BaseModel):
    """Outcome of a DELETE interaction call."""

    interaction_type: str
    active: bool
    post_upvotes: Optional[int] = None
    post_bookmarks: Optional[int] = None
