"""Claude API integration for meal plan generation."""

from __future__ import annotations

import asyncio
import json
import logging

import anthropic
from fastapi import HTTPException, status

from app.config import get_settings

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096
TEMPERATURE = 0.3

# Suffix appended to the prompt on the retry attempt to insist on JSON only
_JSON_RETRY_SUFFIX = (
    "\n\nYour previous response was not valid JSON. "
    "Respond with ONLY a raw JSON object — no markdown, no backticks, "
    "no prose of any kind. Start your response with '{' and end with '}'."
)


async def generate_meal_plan(prompt: str) -> dict:
    """Call Claude to generate a structured meal plan from a prompt.

    Wraps the entire attempt (including one retry) in an ``asyncio.timeout``
    bounded by ``LLM_TIMEOUT_SECONDS`` (default 60 s).  A timeout returns HTTP
    504 so mobile clients receive a fast, actionable error instead of a hanging
    socket.

    Args:
        prompt: The fully-constructed prompt from ``prompt_builder``.

    Returns:
        Parsed dict matching the meals JSON schema (key ``"meals"`` with 3 items).

    Raises:
        HTTPException: 504 if Claude does not respond within the timeout window.
        HTTPException: 502 if the LLM fails or returns unparseable JSON twice.
        HTTPException: 503 if the Anthropic API is unavailable.
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    try:
        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await _generate_with_retry(client, prompt)
    except TimeoutError:
        logger.error(
            "Claude timed out after %s s during meal plan generation.",
            settings.LLM_TIMEOUT_SECONDS,
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "error": "AI service timed out",
                "code": "LLM_TIMEOUT",
                "detail": (
                    f"Meal plan generation exceeded {settings.LLM_TIMEOUT_SECONDS} s. "
                    "Please try again."
                ),
            },
        )


async def _generate_with_retry(client: anthropic.AsyncAnthropic, prompt: str) -> dict:
    """Attempt generation once; retry once with a JSON-only suffix if parsing fails.

    Args:
        client: Initialised AsyncAnthropic client.
        prompt: Original prompt string.

    Returns:
        Parsed meal plan dict.

    Raises:
        HTTPException: 502 if both attempts return unparseable JSON.
    """
    raw = await _call_claude(client, prompt)
    parsed = _try_parse(raw)
    if parsed is not None:
        return parsed

    logger.warning("LLM returned invalid JSON on first attempt; retrying.")
    retry_prompt = prompt + _JSON_RETRY_SUFFIX
    raw = await _call_claude(client, retry_prompt)
    parsed = _try_parse(raw)
    if parsed is not None:
        return parsed

    logger.error("LLM returned invalid JSON on retry. Raw:\n%s", raw[:500])
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail={
            "error": "LLM returned unparseable JSON after retry",
            "code": "LLM_INVALID_JSON",
            "detail": "The AI model failed to produce a valid meal plan structure.",
        },
    )


async def _call_claude(client: anthropic.AsyncAnthropic, prompt: str) -> str:
    """Send a single request to Claude and return the raw text response.

    Args:
        client: Initialised AsyncAnthropic client.
        prompt: Prompt string.

    Returns:
        The raw text content of Claude's response.

    Raises:
        HTTPException: 503 on Anthropic API connectivity errors.
        HTTPException: 502 on other API-level errors.
    """
    try:
        message = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
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


def _try_parse(text: str) -> dict | None:
    """Attempt to parse text as JSON.

    Returns the parsed dict on success, or ``None`` on failure.
    """
    text = text.strip()
    # Strip markdown code fences if the model wrapped its output
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "meals" in data:
            return data
        return None
    except (json.JSONDecodeError, ValueError):
        return None
