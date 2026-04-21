"""Chat router — /api/v1/chat."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, status
from supabase._async.client import AsyncClient

from app.db.client import get_client
from app.models.chat import ChatRequest, ChatResponse
from app.routers.deps import get_current_user
from app.services import chat_service, user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


@router.post(
    "/message",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a message to the NuTradish cultural nutrition assistant",
)
async def send_message(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> ChatResponse:
    """Forward a user message to Claude and return the assistant reply.

    Loads the user's onboarding profile from Supabase and injects it into the
    system prompt so the assistant never re-asks for dietary restrictions,
    allergens, or health conditions already provided during onboarding.
    """
    user_profile: dict | None = None
    try:
        profile = await user_service.get_profile(user_id=current_user["id"], db=db)
        user_profile = profile.model_dump()
    except Exception:
        logger.warning("Could not load profile for user %s — using default prompt.", current_user["id"])

    reply, updated_history, kind, recipe, recipes = await chat_service.get_chat_response(
        message=request.message,
        conversation_history=request.conversation_history,
        user_profile=user_profile,
        excluded_titles=request.excluded_titles,
    )
    return ChatResponse(
        response=reply,
        conversation_history=updated_history,
        kind=kind,
        recipe=recipe,
        recipes=recipes,
    )
