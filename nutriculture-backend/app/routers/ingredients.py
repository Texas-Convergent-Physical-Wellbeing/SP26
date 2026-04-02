"""Ingredients router — /api/v1/ingredients."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from supabase._async.client import AsyncClient

from app.db.client import get_client
from app.models.ingredients import (
    StoreFinderRequest,
    StoreFinderResponse,
    SubstitutionRequest,
    SubstitutionResponse,
)
from app.routers.deps import get_current_user
from app.services import ingredient_service

router = APIRouter(prefix="/api/v1/ingredients", tags=["ingredients"])


@router.post(
    "/stores",
    response_model=StoreFinderResponse,
    status_code=status.HTTP_200_OK,
    summary="Find nearby stores that may carry a cultural ingredient",
)
async def find_stores(
    request: StoreFinderRequest,
    current_user: dict = Depends(get_current_user),
) -> StoreFinderResponse:
    """Query OpenStreetMap for grocery and ethnic food shops near a location.

    No API key required — uses the free public Overpass API.
    Results are sorted by distance. Set ``radius_km`` to control search area
    (max 50 km).

    Tip: call this when a generated meal plan includes an ingredient the user
    is unsure how to source locally.
    """
    return await ingredient_service.find_stores(request)


@router.post(
    "/substitute",
    response_model=SubstitutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get substitution suggestions for an unavailable ingredient",
)
async def get_substitutes(
    request: SubstitutionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> SubstitutionResponse:
    """Return Claude-generated substitutes for an ingredient.

    Results are cached in Supabase after the first generation — subsequent
    requests for the same ingredient are served instantly from cache.
    The ``cached`` field in the response indicates whether the cache was used.
    """
    return await ingredient_service.get_substitutes(request, db)
