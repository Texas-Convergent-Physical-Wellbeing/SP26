"""Claude API integration for the NuTradish conversational chatbot."""

from __future__ import annotations

import asyncio
import logging

import anthropic
from fastapi import HTTPException, status

from app.config import get_settings
from app.models.chat import ChatMessage

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 1024
TEMPERATURE = 0.7
MAX_HISTORY_MESSAGES = 20  # keep last N turns to stay within context limits

SYSTEM_PROMPT = """You are NuTradish, a friendly and knowledgeable cultural nutrition assistant. \
You help users understand how to eat healthily while honouring their cultural food traditions. \
You offer practical, personalised advice on nutrition, meal planning, ingredients, and cooking techniques \
rooted in diverse culinary heritages. You speak warmly, avoid jargon, and always respect the user's \
cultural identity. If asked about medical conditions, recommend consulting a healthcare professional \
while still providing general nutritional context."""


def _trim_history(history: list[ChatMessage]) -> list[ChatMessage]:
    """Return the most recent MAX_HISTORY_MESSAGES messages."""
    return history[-MAX_HISTORY_MESSAGES:]


async def get_chat_response(
    message: str,
    conversation_history: list[ChatMessage],
) -> tuple[str, list[ChatMessage]]:
    """Send a user message to Claude and return the reply with updated history.

    Args:
        message: The user's latest message.
        conversation_history: Prior turns (may be empty for a new conversation).

    Returns:
        Tuple of (assistant_reply, updated_conversation_history).

    Raises:
        HTTPException: 504 on timeout, 503 on connectivity error, 502 on API error.
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    trimmed = _trim_history(conversation_history)
    messages = [{"role": m.role, "content": m.content} for m in trimmed]
    messages.append({"role": "user", "content": message})

    try:
        reply = await asyncio.wait_for(
            _call_claude(client, messages),
            timeout=settings.LLM_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error(
            "Claude timed out after %s s during chat.", settings.LLM_TIMEOUT_SECONDS
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "error": "AI service timed out",
                "code": "LLM_TIMEOUT",
                "detail": (
                    f"Chat response exceeded {settings.LLM_TIMEOUT_SECONDS} s. "
                    "Please try again."
                ),
            },
        )

    updated_history = list(trimmed) + [
        ChatMessage(role="user", content=message),
        ChatMessage(role="assistant", content=reply),
    ]
    return reply, updated_history


async def _call_claude(
    client: anthropic.AsyncAnthropic,
    messages: list[dict],
) -> str:
    """Send a multi-turn message list to Claude and return the raw text reply.

    Args:
        client: Initialised AsyncAnthropic client.
        messages: Full message list including the latest user turn.

    Returns:
        Raw text content of Claude's reply.

    Raises:
        HTTPException: 503 on connection error, 502 on other API errors.
    """
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        return response.content[0].text
    except anthropic.APIConnectionError as exc:
        logger.error("Anthropic API connection error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "AI service unavailable",
                "code": "LLM_CONNECTION_ERROR",
                "detail": str(exc),
            },
        ) from exc
    except anthropic.APIError as exc:
        logger.error("Anthropic API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "AI service error",
                "code": "LLM_API_ERROR",
                "detail": str(exc),
            },
        ) from exc
