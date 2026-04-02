"""Cookbook router — /api/v1/cookbook."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from supabase._async.client import AsyncClient

from app.db.client import get_client
from app.models.cookbook import (
    CookbookEntryResponse,
    CookbookListResponse,
    ModifyCookbookEntryRequest,
    SaveCookbookEntryRequest,
)
from app.routers.deps import get_current_user
from app.services import cookbook_service

router = APIRouter(prefix="/api/v1/cookbook", tags=["cookbook"])


@router.post(
    "",
    response_model=CookbookEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a recipe to the cookbook",
)
async def save_entry(
    request: SaveCookbookEntryRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> CookbookEntryResponse:
    """Save a generated or custom recipe to the user's personal cookbook."""
    return await cookbook_service.save_entry(
        user_id=current_user["id"],
        request=request,
        db=db,
    )


@router.get(
    "",
    response_model=CookbookListResponse,
    status_code=status.HTTP_200_OK,
    summary="List cookbook entries with optional filters",
)
async def list_entries(
    meal_type: Optional[str] = Query(None, description="Filter by meal type"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine tag"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> CookbookListResponse:
    """Return the user's saved cookbook recipes, newest first."""
    return await cookbook_service.list_entries(
        user_id=current_user["id"],
        db=db,
        meal_type=meal_type,
        cuisine=cuisine,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{entry_id}",
    response_model=CookbookEntryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a single cookbook entry",
)
async def get_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> CookbookEntryResponse:
    """Fetch a single cookbook entry by its UUID."""
    return await cookbook_service.get_entry(
        user_id=current_user["id"],
        entry_id=entry_id,
        db=db,
    )


@router.patch(
    "/{entry_id}/modify",
    response_model=CookbookEntryResponse,
    status_code=status.HTTP_200_OK,
    summary="Add personal modification notes to a cookbook entry",
)
async def modify_entry(
    entry_id: str,
    request: ModifyCookbookEntryRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> CookbookEntryResponse:
    """Record personal modifications to a saved recipe.

    Modification notes are fed back into future meal plan generation so
    Claude learns the user's personal cooking habits (e.g. 'always reduce
    oil by half', 'substitute cream with coconut milk').
    """
    return await cookbook_service.modify_entry(
        user_id=current_user["id"],
        entry_id=entry_id,
        request=request,
        db=db,
    )


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete a cookbook entry",
)
async def delete_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
):
    """Permanently delete a cookbook entry."""
    await cookbook_service.delete_entry(
        user_id=current_user["id"],
        entry_id=entry_id,
        db=db,
    )
