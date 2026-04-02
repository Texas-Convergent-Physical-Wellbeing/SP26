"""Business logic for taste learning: feedback recording and preference inference."""

from __future__ import annotations

import logging

import anthropic
from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

from app.config import get_settings
from app.models.taste import (
    FeedbackResponse,
    SubmitFeedbackRequest,
    TastePreferenceSummary,
)

logger = logging.getLogger(__name__)

_TABLE = "meal_feedback"
_FEEDBACK_HISTORY_LIMIT = 30
"""Number of recent feedback entries passed to Claude for preference inference."""


async def submit_feedback(
    user_id: str,
    request: SubmitFeedbackRequest,
    db: AsyncClient,
) -> FeedbackResponse:
    """Record a user's reaction to a generated meal.

    Args:
        user_id: Authenticated user UUID.
        request: Validated feedback payload.
        db: Supabase async client.

    Returns:
        The created ``FeedbackResponse``.

    Raises:
        HTTPException: 422 if action is 'modified' but no modification_notes provided.
        HTTPException: 500 on DB error.
    """
    if request.action.value == "modified" and not request.modification_notes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Modification notes required",
                "code": "MODIFICATION_NOTES_MISSING",
                "detail": "modification_notes must be provided when action is 'modified'.",
            },
        )

    payload: dict = {
        "user_id": user_id,
        "plan_date": request.plan_date,
        "meal_type": request.meal_type,
        "dish_name": request.dish_name,
        "cuisine_tag": request.cuisine_tag,
        "action": request.action.value,
        "modification_notes": request.modification_notes,
    }
    if request.modified_macros:
        payload["modified_macros"] = request.modified_macros.model_dump()

    result = await db.table(_TABLE).insert(payload).execute()
    row = _extract_single(result, "insert feedback")
    return _row_to_response(row)


async def get_preference_summary(
    user_id: str,
    db: AsyncClient,
) -> TastePreferenceSummary:
    """Infer taste preferences by passing recent feedback history to Claude.

    Fetches the last ``_FEEDBACK_HISTORY_LIMIT`` feedback entries and sends
    them to Claude, which identifies patterns in saved/skipped meals, infers
    sub-cuisine leanings, and flags avoided ingredients.

    Args:
        user_id: Authenticated user UUID.
        db: Supabase async client.

    Returns:
        A ``TastePreferenceSummary`` with Claude-generated insights.

    Raises:
        HTTPException: 404 if no feedback exists yet.
        HTTPException: 502 on Claude API errors.
    """
    result = (
        await db.table(_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(_FEEDBACK_HISTORY_LIMIT)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "No feedback found",
                "code": "NO_FEEDBACK",
                "detail": "Submit meal feedback first to generate a preference summary.",
            },
        )

    return await _infer_preferences_with_claude(rows)


async def get_recent_feedback(user_id: str, db: AsyncClient) -> list[dict]:
    """Return the most recent feedback rows for prompt injection.

    Used by ``meal_plan_service`` to pass taste history to the LLM prompt.

    Args:
        user_id: Authenticated user UUID.
        db: Supabase async client.

    Returns:
        List of raw feedback dicts (up to ``_FEEDBACK_HISTORY_LIMIT``).
    """
    result = (
        await db.table(_TABLE)
        .select("meal_type, dish_name, cuisine_tag, action, modification_notes")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(_FEEDBACK_HISTORY_LIMIT)
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


async def _infer_preferences_with_claude(
    feedback_rows: list[dict],
) -> TastePreferenceSummary:
    """Send feedback history to Claude and parse structured preference insights."""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    feedback_text = _format_feedback_for_prompt(feedback_rows)
    prompt = _build_inference_prompt(feedback_text)

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text
        return _parse_inference_response(raw, len(feedback_rows))
    except anthropic.APIError as exc:
        logger.error("Claude preference inference failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "Preference inference failed",
                "code": "LLM_INFERENCE_ERROR",
                "detail": str(exc),
            },
        ) from exc


def _format_feedback_for_prompt(rows: list[dict]) -> str:
    """Convert raw feedback rows into a readable list for the prompt."""
    lines = []
    for r in rows:
        line = f"- [{r['action'].upper()}] {r['dish_name']} ({r.get('cuisine_tag', 'unknown cuisine')})"
        if r.get("modification_notes"):
            line += f" | Modified: {r['modification_notes']}"
        lines.append(line)
    return "\n".join(lines)


def _build_inference_prompt(feedback_text: str) -> str:
    """Build the Claude prompt for preference inference."""
    return (
        "You are a nutrition and culinary analyst. Analyse this user's meal feedback "
        "history and infer their taste preferences.\n\n"
        f"## Feedback History\n{feedback_text}\n\n"
        "Return a JSON object with exactly these keys:\n"
        "{\n"
        '  "summary": "<2-3 sentence natural language summary of preferences>",\n'
        '  "inferred_sub_cuisines": ["<sub-cuisine>", ...],\n'
        '  "avoided_ingredients": ["<ingredient>", ...],\n'
        '  "preferred_cooking_styles": ["<style>", ...]\n'
        "}\n\n"
        "Respond with ONLY the JSON object, no prose."
    )


def _parse_inference_response(raw: str, feedback_count: int) -> TastePreferenceSummary:
    """Parse Claude's JSON inference response into a ``TastePreferenceSummary``."""
    import json

    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        data = json.loads(raw)
        return TastePreferenceSummary(
            summary=data.get("summary", ""),
            inferred_sub_cuisines=data.get("inferred_sub_cuisines", []),
            avoided_ingredients=data.get("avoided_ingredients", []),
            preferred_cooking_styles=data.get("preferred_cooking_styles", []),
            feedback_count=feedback_count,
        )
    except (json.JSONDecodeError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "Failed to parse preference summary",
                "code": "LLM_PARSE_ERROR",
                "detail": str(exc),
            },
        ) from exc


def _extract_single(result, operation: str) -> dict:
    """Pull the first row or raise 500."""
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"DB error: {operation}", "code": "DB_ERROR", "detail": "No data returned."},
        )
    data = result.data
    return data[0] if isinstance(data, list) else data


def _row_to_response(row: dict) -> FeedbackResponse:
    """Map a raw meal_feedback row to a ``FeedbackResponse``."""
    return FeedbackResponse(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        plan_date=str(row["plan_date"]),
        meal_type=row["meal_type"],
        dish_name=row["dish_name"],
        cuisine_tag=row.get("cuisine_tag"),
        action=row["action"],
        modification_notes=row.get("modification_notes"),
        created_at=row["created_at"],
    )
