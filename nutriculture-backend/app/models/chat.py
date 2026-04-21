"""Pydantic request/response models for chat endpoints."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single message in a conversation turn."""

    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    """Payload for POST /api/v1/chat/message."""

    message: str
    conversation_history: list[ChatMessage] = Field(default_factory=list)
    # Titles of recipes already surfaced in this chat session. The backend injects
    # these into the system prompt so the LLM never repeats the same dish.
    excluded_titles: list[str] = Field(default_factory=list)


class RecipeMacros(BaseModel):
    calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fat_g: Optional[int] = None
    fiber_g: Optional[int] = None


class RecipePayload(BaseModel):
    """Structured recipe data for the LLM Wrapper UI."""

    title: str
    summary: str
    ingredients: list[str]
    steps: list[str]
    macros: Optional[RecipeMacros] = None
    health_tags: list[str] = Field(default_factory=list)
    why_this_works: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from the chat endpoint."""

    response: str
    conversation_history: list[ChatMessage]
    kind: Literal["text", "recipe", "meal_plan"] = "text"
    recipe: Optional[RecipePayload] = None
    recipes: Optional[list[RecipePayload]] = None
