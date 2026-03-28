"""Business logic for meal plan generation, storage, and retrieval."""

from __future__ import annotations

import logging
from datetime import date

from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

from app.models.meal_plan import MealPlanResponse, MealPlanListResponse, MealObject
from app.services import user_service, llm_service
from app.utils.prompt_builder import build_meal_plan_prompt

logger = logging.getLogger(__name__)

_TABLE = "meal_plans"


async def generate_and_store_plan(
    user_id: str,
    plan_date: date,
    db: AsyncClient,
) -> MealPlanResponse:
    """Generate a meal plan via Claude and persist it to Supabase.

    Steps:
    1. Fetch the user's stored profile.
    2. Build the LLM prompt.
    3. Call Claude to generate the plan.
    4. Validate the response structure.
    5. Upsert into ``meal_plans`` (overwrite if same date exists).
    6. Return the full plan.

    Args:
        user_id: Authenticated user UUID.
        plan_date: Target date for the meal plan.
        db: Supabase async client.

    Returns:
        The newly generated and stored ``MealPlanResponse``.

    Raises:
        HTTPException: 404 if the user has no profile.
        HTTPException: 502 if Claude fails.
        HTTPException: 500 on DB errors.
    """
    profile = await user_service.get_profile(user_id, db)
    profile_dict = profile.model_dump()

    prompt = build_meal_plan_prompt(profile_dict, plan_date.isoformat())
    llm_response = await llm_service.generate_meal_plan(prompt)

    meals_raw = llm_response.get("meals", [])
    _validate_meals_structure(meals_raw)

    payload = {
        "user_id": user_id,
        "plan_date": plan_date.isoformat(),
        "meals": meals_raw,
    }

    result = (
        await db.table(_TABLE)
        .upsert(payload, on_conflict="user_id,plan_date")
        .execute()
    )

    row = _extract_single(result, "upsert meal plan")
    return _row_to_response(row)


async def get_plan(
    user_id: str,
    plan_date: date,
    db: AsyncClient,
) -> MealPlanResponse:
    """Retrieve a stored meal plan for a specific date.

    Args:
        user_id: Authenticated user UUID.
        plan_date: The date whose plan to retrieve.
        db: Supabase async client.

    Returns:
        The stored ``MealPlanResponse``.

    Raises:
        HTTPException: 404 if no plan exists for the given date.
    """
    result = (
        await db.table(_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("plan_date", plan_date.isoformat())
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Meal plan not found",
                "code": "PLAN_NOT_FOUND",
                "detail": f"No meal plan exists for {plan_date.isoformat()}.",
            },
        )
    return _row_to_response(result.data)


async def list_plans(
    user_id: str,
    limit: int,
    offset: int,
    db: AsyncClient,
) -> MealPlanListResponse:
    """List paginated meal plans for the authenticated user.

    Args:
        user_id: Authenticated user UUID.
        limit: Maximum number of records to return.
        offset: Number of records to skip.
        db: Supabase async client.

    Returns:
        A ``MealPlanListResponse`` with plans and pagination metadata.
    """
    result = (
        await db.table(_TABLE)
        .select("*", count="exact")
        .eq("user_id", user_id)
        .order("plan_date", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    rows = result.data or []
    total = result.count or 0
    plans = [_row_to_response(r) for r in rows]
    return MealPlanListResponse(plans=plans, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _validate_meals_structure(meals: list) -> None:
    """Confirm the LLM response contains exactly 3 valid meal objects.

    Args:
        meals: Raw list parsed from the LLM JSON response.

    Raises:
        HTTPException: 502 if the structure is wrong.
    """
    if not isinstance(meals, list) or len(meals) != 3:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "Invalid meal plan structure",
                "code": "LLM_SCHEMA_MISMATCH",
                "detail": f"Expected 3 meals, got {len(meals) if isinstance(meals, list) else type(meals).__name__}.",
            },
        )
    required_types = {"breakfast", "lunch", "dinner"}
    returned_types = {m.get("meal_type") for m in meals if isinstance(m, dict)}
    if returned_types != required_types:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "Missing meal types",
                "code": "LLM_MISSING_MEAL_TYPES",
                "detail": f"Expected {required_types}, got {returned_types}.",
            },
        )


def _extract_single(result, operation: str) -> dict:
    """Pull the first row from a Supabase result or raise 500."""
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": f"Database operation failed: {operation}",
                "code": "DB_ERROR",
                "detail": "No data returned from Supabase.",
            },
        )
    data = result.data
    return data[0] if isinstance(data, list) else data


def _row_to_response(row: dict) -> MealPlanResponse:
    """Map a raw Supabase row dict to a ``MealPlanResponse``."""
    meals = [MealObject(**m) for m in (row.get("meals") or [])]
    return MealPlanResponse(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        plan_date=row["plan_date"],
        meals=meals,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
