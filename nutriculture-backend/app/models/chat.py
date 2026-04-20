"""Pydantic request/response models for chat endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single message in a conversation turn."""

    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    """Payload for POST /api/v1/chat/message."""

    message: str
    conversation_history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Response from the chat endpoint."""

    response: str
    conversation_history: list[ChatMessage]
