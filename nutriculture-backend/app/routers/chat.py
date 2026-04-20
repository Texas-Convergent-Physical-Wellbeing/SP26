"""Chat router — /api/v1/chat."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.models.chat import ChatRequest, ChatResponse
from app.routers.deps import get_current_user
from app.services import chat_service

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
) -> ChatResponse:
    """Forward a user message to Claude and return the assistant reply.

    Accepts optional conversation history so the model has multi-turn context.
    Returns the reply and the full updated history for the client to persist.
    """
    reply, updated_history = await chat_service.get_chat_response(
        message=request.message,
        conversation_history=request.conversation_history,
    )
    return ChatResponse(response=reply, conversation_history=updated_history)
