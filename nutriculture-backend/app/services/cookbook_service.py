"""Business logic for cookbook entry management."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

from app.models.cookbook import (
    CookbookEntryResponse,
    CookbookListResponse,
    ModifyCookbookEntryRequest,
    SaveCookbookEntryRequest,
)
from app.models.meal_plan import Ingredient, MealMacros, MealMicros

logger = logging.getLogger(__name__)

_TABLE = "cookbook_entries"


async def save_entry(
    user_id: str,
    request: SaveCookbookEntryRequest,
    db: AsyncClient,
) -> CookbookEntryResponse:
    """Save a recipe to the user's cookbook.

    Args:
        user_id: Authenticated user UUID.
        request: Validated save payload.
        db: Supabase async client.

    Returns:
        The created ``CookbookEntryResponse``.
    """
    payload = {
        "user_id": user_id,
        "dish_name": request.dish_name,
        "meal_type": request.meal_type,
        "cuisine_tag": request.cuisine_tag,
        "source_plan_date": request.source_plan_date,
        "ingredients": [i.model_dump() for i in request.ingredients],
        "macros": request.macros.model_dump(),
        "micros": request.micros.model_dump() if request.micros else None,
    }
    result = await db.table(_TABLE).insert(payload).execute()
    row = _extract_single(result, "insert cookbook entry")
    return _row_to_response(row)


async def list_entries(
    user_id: str,
    db: AsyncClient,
    meal_type: Optional[str] = None,
    cuisine: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> CookbookListResponse:
    """Return the user's cookbook entries with optional filters.

    Args:
        user_id: Authenticated user UUID.
        db: Supabase async client.
        meal_type: Optional filter by meal type.
        cuisine: Optional filter by cuisine tag.
        limit: Max records to return.
        offset: Records to skip.

    Returns:
        Paginated ``CookbookListResponse``.
    """
    query = db.table(_TABLE).select("*", count="exact").eq("user_id", user_id)
    if meal_type:
        query = query.eq("meal_type", meal_type)
    if cuisine:
        query = query.eq("cuisine_tag", cuisine)
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)

    result = await query.execute()
    rows = result.data or []
    total = result.count or 0
    return CookbookListResponse(
        entries=[_row_to_response(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


async def get_entry(
    user_id: str,
    entry_id: str,
    db: AsyncClient,
) -> CookbookEntryResponse:
    """Fetch a single cookbook entry by ID.

    Args:
        user_id: Authenticated user UUID.
        entry_id: UUID of the cookbook entry.
        db: Supabase async client.

    Returns:
        The requested ``CookbookEntryResponse``.

    Raises:
        HTTPException: 404 if not found or not owned by this user.
    """
    result = (
        await db.table(_TABLE)
        .select("*")
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Cookbook entry not found",
                "code": "COOKBOOK_ENTRY_NOT_FOUND",
                "detail": f"No cookbook entry with id {entry_id}.",
            },
        )
    return _row_to_response(result.data)


async def modify_entry(
    user_id: str,
    entry_id: str,
    request: ModifyCookbookEntryRequest,
    db: AsyncClient,
) -> CookbookEntryResponse:
    """Add modification notes and optional adjusted macros to a cookbook entry.

    Args:
        user_id: Authenticated user UUID.
        entry_id: UUID of the cookbook entry to modify.
        request: Validated modification payload.
        db: Supabase async client.

    Returns:
        The updated ``CookbookEntryResponse``.

    Raises:
        HTTPException: 404 if not found or not owned by this user.
    """
    await get_entry(user_id, entry_id, db)  # ownership check

    update: dict = {"user_modifications": request.user_modifications}
    if request.adjusted_macros:
        update["adjusted_macros"] = request.adjusted_macros.model_dump()

    result = (
        await db.table(_TABLE)
        .update(update)
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .execute()
    )
    row = _extract_single(result, "update cookbook entry")
    return _row_to_response(row)


async def delete_entry(
    user_id: str,
    entry_id: str,
    db: AsyncClient,
) -> None:
    """Delete a cookbook entry.

    Args:
        user_id: Authenticated user UUID.
        entry_id: UUID of the cookbook entry to delete.
        db: Supabase async client.

    Raises:
        HTTPException: 404 if not found or not owned by this user.
    """
    await get_entry(user_id, entry_id, db)  # ownership check
    await db.table(_TABLE).delete().eq("id", entry_id).eq("user_id", user_id).execute()


async def get_modifications_for_prompt(user_id: str, db: AsyncClient) -> list[str]:
    """Return modification notes from saved cookbook entries for prompt injection.

    Used by ``meal_plan_service`` to pass personal cooking habits to Claude
    (e.g. "this user always reduces oil by half in curries").

    Args:
        user_id: Authenticated user UUID.
        db: Supabase async client.

    Returns:
        List of non-null modification note strings (up to 10 most recent).
    """
    result = (
        await db.table(_TABLE)
        .select("user_modifications")
        .eq("user_id", user_id)
        .not_.is_("user_modifications", "null")
        .order("updated_at", desc=True)
        .limit(10)
        .execute()
    )
    return [r["user_modifications"] for r in (result.data or []) if r.get("user_modifications")]


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _extract_single(result, operation: str) -> dict:
    """Pull the first row or raise 500."""
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": f"DB error: {operation}", "code": "DB_ERROR", "detail": "No data returned."},
        )
    data = result.data
    return data[0] if isinstance(data, list) else data


def _row_to_response(row: dict) -> CookbookEntryResponse:
    """Map a raw cookbook_entries row to a ``CookbookEntryResponse``."""
    macros_raw = row.get("macros") or {}
    micros_raw = row.get("micros")
    adjusted_raw = row.get("adjusted_macros")

    return CookbookEntryResponse(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        dish_name=row["dish_name"],
        meal_type=row["meal_type"],
        cuisine_tag=row.get("cuisine_tag"),
        source_plan_date=str(row["source_plan_date"]) if row.get("source_plan_date") else None,
        ingredients=[Ingredient(**i) for i in (row.get("ingredients") or [])],
        macros=MealMacros(**macros_raw),
        micros=MealMicros(**micros_raw) if micros_raw else None,
        user_modifications=row.get("user_modifications"),
        adjusted_macros=MealMacros(**adjusted_raw) if adjusted_raw else None,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
