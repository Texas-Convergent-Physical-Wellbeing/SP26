"""Business logic for user profile management."""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

from app.models.user import (
    SetFestiveEventRequest,
    UserProfileUpsertRequest,
    UserProfileResponse,
    MacroTargets,
)
from app.utils.macro_calculator import calculate_bmr, calculate_tdee, calculate_macro_targets

logger = logging.getLogger(__name__)

_TABLE = "user_profiles"


async def create_or_update_profile(
    user_id: str,
    request: UserProfileUpsertRequest,
    db: AsyncClient,
) -> UserProfileResponse:
    """Upsert a user's health profile and recompute BMR / TDEE / macros.

    Computes nutrition targets automatically from the supplied demographics
    and stores them alongside the profile data.

    Args:
        user_id: The authenticated user's UUID.
        request: Validated profile upsert payload.
        db: Supabase async client.

    Returns:
        The full updated ``UserProfileResponse``.

    Raises:
        HTTPException: 422 if cuisine limit exceeded (validated by Pydantic,
            but also defended here), or 500 on DB errors.
    """
    validate_cuisines_limit(request.cuisines)

    bmr = calculate_bmr(request.sex, request.age, request.weight_kg, request.height_cm)
    tdee = calculate_tdee(bmr, request.activity_level)
    condition_values = [c.value for c in request.health_conditions]
    macro_dict = calculate_macro_targets(tdee, request.health_conditions, request.weight_kg)

    payload = {
        "user_id": user_id,
        "sex": request.sex,
        "age": request.age,
        "weight_kg": float(request.weight_kg),
        "height_cm": float(request.height_cm),
        "health_conditions": condition_values,
        "allergens": [a.value for a in request.allergens],
        "cuisines": [c.value for c in request.cuisines],
        "diet_preferences": [d.value for d in request.diet_preferences],
        "skill_level": request.skill_level.value,
        "shortcut_mode": request.shortcut_mode,
        "tdee": tdee,
        "macro_targets": macro_dict,
    }

    result = (
        await db.table(_TABLE)
        .upsert(payload, on_conflict="user_id")
        .execute()
    )

    row = _extract_single(result, "upsert profile")
    return _row_to_response(row)


async def get_profile(user_id: str, db: AsyncClient) -> UserProfileResponse:
    """Fetch the stored profile for a given user.

    Args:
        user_id: The authenticated user's UUID.
        db: Supabase async client.

    Returns:
        The user's ``UserProfileResponse``.

    Raises:
        HTTPException: 404 if no profile exists for this user.
    """
    result = (
        await db.table(_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Profile not found",
                "code": "PROFILE_NOT_FOUND",
                "detail": f"No profile exists for user {user_id}.",
            },
        )

    return _row_to_response(result.data)


async def set_festive_event(
    user_id: str,
    request: SetFestiveEventRequest,
    db: AsyncClient,
) -> UserProfileResponse:
    """Activate a festive mode on the user's profile.

    Args:
        user_id: Authenticated user UUID.
        request: Festive event payload with event type and date range.
        db: Supabase async client.

    Returns:
        Updated ``UserProfileResponse`` with festive fields set.

    Raises:
        HTTPException: 404 if the user has no profile.
    """
    await get_profile(user_id, db)  # existence check
    update = {
        "active_festive_event": request.event.value,
        "festive_event_start": request.start_date,
        "festive_event_end": request.end_date,
    }
    result = (
        await db.table(_TABLE)
        .update(update)
        .eq("user_id", user_id)
        .execute()
    )
    row = _extract_single(result, "set festive event")
    return _row_to_response(row)


async def clear_festive_event(user_id: str, db: AsyncClient) -> UserProfileResponse:
    """Deactivate the current festive mode on the user's profile.

    Args:
        user_id: Authenticated user UUID.
        db: Supabase async client.

    Returns:
        Updated ``UserProfileResponse`` with festive fields cleared.
    """
    await get_profile(user_id, db)  # existence check
    result = (
        await db.table(_TABLE)
        .update({
            "active_festive_event": None,
            "festive_event_start": None,
            "festive_event_end": None,
        })
        .eq("user_id", user_id)
        .execute()
    )
    row = _extract_single(result, "clear festive event")
    return _row_to_response(row)


def validate_cuisines_limit(cuisines: list) -> None:
    """Raise HTTP 422 if more than 3 cuisines are provided.

    Args:
        cuisines: List of cuisine values from the request.

    Raises:
        HTTPException: 422 if ``len(cuisines) > 3``.
    """
    if len(cuisines) > 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Too many cuisines",
                "code": "CUISINE_LIMIT_EXCEEDED",
                "detail": "A maximum of 3 cuisine preferences is allowed.",
            },
        )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


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


def _row_to_response(row: dict) -> UserProfileResponse:
    """Map a raw Supabase row dict to a ``UserProfileResponse``."""
    macro_raw = row.get("macro_targets")
    macro_targets = MacroTargets(**macro_raw) if macro_raw else None
    return UserProfileResponse(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        sex=row["sex"],
        age=row["age"],
        weight_kg=float(row["weight_kg"]),
        height_cm=float(row["height_cm"]),
        health_conditions=row.get("health_conditions") or [],
        allergens=row.get("allergens") or [],
        cuisines=row.get("cuisines") or [],
        diet_preferences=row.get("diet_preferences") or [],
        skill_level=row.get("skill_level") or "intermediate",
        shortcut_mode=row.get("shortcut_mode") or False,
        active_festive_event=row.get("active_festive_event"),
        festive_event_start=str(row["festive_event_start"]) if row.get("festive_event_start") else None,
        festive_event_end=str(row["festive_event_end"]) if row.get("festive_event_end") else None,
        tdee=row.get("tdee"),
        macro_targets=macro_targets,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
