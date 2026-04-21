"""Claude API integration for the NuTradish conversational chatbot."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Optional, Tuple

import anthropic
from fastapi import HTTPException, status

from app.config import get_settings
from app.models.chat import ChatMessage, RecipeMacros, RecipePayload

logger = logging.getLogger(__name__)

MODEL_TEXT = "claude-sonnet-4-6"
# Faster model for structured recipe JSON. If unavailable, we fall back to MODEL_TEXT.
MODEL_RECIPE_FAST = "claude-3-5-haiku-latest"
MAX_TOKENS_TEXT = 384
MAX_TOKENS_RECIPE = 700
TEMPERATURE = 0.7
MAX_HISTORY_MESSAGES = 8  # keep last N turns to stay within context limits

SYSTEM_PROMPT = """You are NuTradish, a friendly and knowledgeable cultural nutrition assistant. \
You help users understand how to eat healthily while honouring their cultural food traditions. \
You offer practical, personalised advice on nutrition, meal planning, ingredients, and cooking techniques \
rooted in diverse culinary heritages. You speak warmly, avoid jargon, and always respect the user's \
cultural identity. If asked about medical conditions, recommend consulting a healthcare professional \
while still providing general nutritional context."""

RECIPE_JSON_INSTRUCTIONS = """When the user asks you to suggest a meal, generate a recipe, adapt a dish, or provide substitutions, respond in STRICT JSON ONLY.

Return an object with exactly these keys:
{
  "response": string,
  "recipe": {
    "title": string,
    "summary": string,
    "ingredients": string[],
    "steps": string[],
    "macros": {
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number
    },
    "why_this_works": string
  }
}

Rules:
- Output MUST be valid JSON. No markdown, no backticks.
- Ingredients and steps must be concrete and actionable.
- If you are unsure of exact macros, provide best-effort estimates as integers.
"""


def _trim_history(history: list[ChatMessage]) -> list[ChatMessage]:
    """Return the most recent MAX_HISTORY_MESSAGES messages."""
    return history[-MAX_HISTORY_MESSAGES:]


def _get_client() -> anthropic.AsyncAnthropic:
    """Return a cached Anthropic client for connection pooling."""
    settings = get_settings()
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def _looks_like_recipe_request(message: str) -> bool:
    m = message.lower()
    keywords = [
        "suggest",
        "recipe",
        "meal plan",
        "breakfast",
        "lunch",
        "dinner",
        "substitute",
        "swap",
        "adapt",
    ]
    return any(k in m for k in keywords)


def _parse_recipe_json(raw: str) -> Optional[Tuple[str, RecipePayload]]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None

    response = data.get("response")
    recipe = data.get("recipe")
    if not isinstance(response, str) or not isinstance(recipe, dict):
        return None

    title = recipe.get("title")
    summary = recipe.get("summary")
    ingredients = recipe.get("ingredients")
    steps = recipe.get("steps")
    why = recipe.get("why_this_works")
    macros = recipe.get("macros")

    if not isinstance(title, str) or not isinstance(summary, str):
        return None
    if not isinstance(ingredients, list) or not all(isinstance(i, str) for i in ingredients):
        return None
    if not isinstance(steps, list) or not all(isinstance(s, str) for s in steps):
        return None

    def _int_or_none(v):
        if isinstance(v, (int, float)):
            return int(v)
        return None

    macros_obj: Optional[RecipeMacros] = None
    if isinstance(macros, dict):
        macros_obj = RecipeMacros(
            calories=_int_or_none(macros.get("calories")),
            protein_g=_int_or_none(macros.get("protein_g")),
            carbs_g=_int_or_none(macros.get("carbs_g")),
            fat_g=_int_or_none(macros.get("fat_g")),
            fiber_g=_int_or_none(macros.get("fiber_g")),
        )

    payload = RecipePayload(
        title=title,
        summary=summary,
        ingredients=ingredients,
        steps=steps,
        macros=macros_obj,
        why_this_works=why if isinstance(why, str) else None,
    )
    return response, payload


async def get_chat_response(
    message: str,
    conversation_history: list[ChatMessage],
) -> tuple[str, list[ChatMessage], str, Optional[RecipePayload]]:
    """Send a user message to Claude and return the reply with updated history.

    Args:
        message: The user's latest message.
        conversation_history: Prior turns (may be empty for a new conversation).

    Returns:
        Tuple of (assistant_reply, updated_conversation_history, kind, recipe_payload).

    Raises:
        HTTPException: 504 on timeout, 503 on connectivity error, 502 on API error.
    """
    settings = get_settings()
    client = _get_client()

    trimmed = _trim_history(conversation_history)
    messages = [{"role": m.role, "content": m.content} for m in trimmed]
    messages.append({"role": "user", "content": message})

    try:
        t0 = time.perf_counter()
        if _looks_like_recipe_request(message):
            # Try a faster recipe model first; fall back if the account doesn't support it.
            try:
                raw = await asyncio.wait_for(
                    _call_claude(
                        client,
                        messages,
                        model=MODEL_RECIPE_FAST,
                        system_prompt=f"{SYSTEM_PROMPT}\n\n{RECIPE_JSON_INSTRUCTIONS}\n\nKeep responses concise.",
                        temperature=0.15,
                        max_tokens=MAX_TOKENS_RECIPE,
                    ),
                    timeout=settings.LLM_TIMEOUT_SECONDS,
                )
            except anthropic.APIError as exc:
                logger.warning("Recipe fast model failed, falling back: %s", exc)
                raw = await asyncio.wait_for(
                    _call_claude(
                        client,
                        messages,
                        model=MODEL_TEXT,
                        system_prompt=f"{SYSTEM_PROMPT}\n\n{RECIPE_JSON_INSTRUCTIONS}\n\nKeep responses concise.",
                        temperature=0.15,
                        max_tokens=MAX_TOKENS_RECIPE,
                    ),
                    timeout=settings.LLM_TIMEOUT_SECONDS,
                )
            parsed = _parse_recipe_json(raw)
            if parsed:
                reply, recipe_payload = parsed
                kind = "recipe"
            else:
                reply = raw
                recipe_payload = None
                kind = "text"
        else:
            reply = await asyncio.wait_for(
                _call_claude(client, messages, model=MODEL_TEXT, max_tokens=MAX_TOKENS_TEXT),
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
            recipe_payload = None
            kind = "text"
        dt_ms = int((time.perf_counter() - t0) * 1000)
        logger.info("chat_service.get_chat_response kind=%s ms=%s history=%s", kind, dt_ms, len(trimmed))
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
    return reply, updated_history, kind, recipe_payload


async def _call_claude(
    client: anthropic.AsyncAnthropic,
    messages: list[dict],
    model: str,
    system_prompt: str = SYSTEM_PROMPT,
    temperature: float = TEMPERATURE,
    max_tokens: int = MAX_TOKENS_TEXT,
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
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
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
