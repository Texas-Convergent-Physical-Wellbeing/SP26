"""Business logic for ingredient store finder and substitution suggestions."""

from __future__ import annotations

import logging
import math
from typing import Any

import anthropic
import httpx
from fastapi import HTTPException, status
from supabase._async.client import AsyncClient

from app.config import get_settings
from app.models.ingredients import (
    StoreFinderRequest,
    StoreFinderResponse,
    StoreResult,
    SubstituteOption,
    SubstitutionRequest,
    SubstitutionResponse,
)

logger = logging.getLogger(__name__)

_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_CACHE_TABLE = "ingredient_substitutions"

# OSM shop tags likely to carry cultural/ethnic ingredients
_ETHNIC_SHOP_TAGS = [
    "supermarket", "convenience", "greengrocer", "deli",
    "ethnic_grocery", "spices", "health_food", "farm",
]


async def find_stores(request: StoreFinderRequest) -> StoreFinderResponse:
    """Query OpenStreetMap via Overpass API for shops near a coordinate.

    Searches within ``radius_km`` for grocery and ethnic food shops.
    No API key required — uses the public Overpass API.

    Args:
        request: Validated store finder request with lat/lng/radius/ingredient.

    Returns:
        ``StoreFinderResponse`` with matching stores sorted by distance.

    Raises:
        HTTPException: 502 if the Overpass API is unreachable.
        HTTPException: 504 if the Overpass query times out.
    """
    radius_m = int(request.radius_km * 1000)
    query = _build_overpass_query(request.lat, request.lng, radius_m)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(_OVERPASS_URL, data={"data": query})
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "error": "Store finder timed out",
                "code": "OVERPASS_TIMEOUT",
                "detail": "OpenStreetMap query exceeded 15 s. Try a smaller radius.",
            },
        )
    except httpx.HTTPError as exc:
        logger.error("Overpass API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "Store finder unavailable",
                "code": "OVERPASS_ERROR",
                "detail": str(exc),
            },
        )

    stores = _parse_overpass_response(data, request.lat, request.lng)
    stores.sort(key=lambda s: s.distance_km)

    return StoreFinderResponse(
        ingredient=request.ingredient,
        stores=stores,
        total_found=len(stores),
        radius_km=request.radius_km,
    )


async def get_substitutes(
    request: SubstitutionRequest,
    db: AsyncClient,
) -> SubstitutionResponse:
    """Return substitution suggestions for an ingredient, using cache when available.

    Checks the ``ingredient_substitutions`` table first. On a cache miss,
    calls Claude to generate substitutes and caches the result.

    Args:
        request: Validated substitution request.
        db: Supabase async client.

    Returns:
        ``SubstitutionResponse`` with substitute options.

    Raises:
        HTTPException: 502 on Claude API errors.
    """
    cached = await _get_cached_substitutes(request.ingredient, db)
    if cached is not None:
        return SubstitutionResponse(
            ingredient=request.ingredient,
            substitutes=cached,
            cached=True,
        )

    substitutes = await _generate_substitutes_with_claude(request)
    await _cache_substitutes(request.ingredient, request.health_conditions, substitutes, db)

    return SubstitutionResponse(
        ingredient=request.ingredient,
        substitutes=substitutes,
        cached=False,
    )


# ---------------------------------------------------------------------------
# Private helpers — store finder
# ---------------------------------------------------------------------------


def _build_overpass_query(lat: float, lng: float, radius_m: int) -> str:
    """Construct an Overpass QL query for grocery/ethnic shops within radius."""
    tag_filters = "\n".join(
        f'  node["shop"="{tag}"](around:{radius_m},{lat},{lng});'
        for tag in _ETHNIC_SHOP_TAGS
    )
    return (
        f"[out:json][timeout:10];\n"
        f"(\n"
        f"{tag_filters}\n"
        f');\n'
        f'out body;'
    )


def _parse_overpass_response(
    data: dict[str, Any],
    origin_lat: float,
    origin_lng: float,
) -> list[StoreResult]:
    """Convert Overpass API elements into ``StoreResult`` objects."""
    stores: list[StoreResult] = []
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        node_lat = element.get("lat")
        node_lng = element.get("lon")
        if node_lat is None or node_lng is None:
            continue

        name = tags.get("name") or tags.get("brand") or "Unnamed store"
        address = _build_address(tags)
        distance = _haversine_km(origin_lat, origin_lng, node_lat, node_lng)

        stores.append(
            StoreResult(
                name=name,
                address=address,
                lat=node_lat,
                lng=node_lng,
                distance_km=round(distance, 2),
                store_type=tags.get("shop"),
                osm_id=str(element.get("id")),
            )
        )
    return stores


def _build_address(tags: dict) -> str | None:
    """Assemble a readable address string from OSM address tags."""
    parts = [
        tags.get("addr:housenumber", ""),
        tags.get("addr:street", ""),
        tags.get("addr:city", ""),
        tags.get("addr:postcode", ""),
    ]
    address = " ".join(p for p in parts if p).strip()
    return address or None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance in km between two coordinates."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Private helpers — substitutions
# ---------------------------------------------------------------------------


async def _get_cached_substitutes(
    ingredient: str,
    db: AsyncClient,
) -> list[SubstituteOption] | None:
    """Return cached substitutes for an ingredient, or None on a cache miss."""
    result = (
        await db.table(_CACHE_TABLE)
        .select("substitutes")
        .eq("ingredient_name", ingredient.lower())
        .single()
        .execute()
    )
    if not result.data:
        return None
    raw_list = result.data.get("substitutes") or []
    return [SubstituteOption(**s) for s in raw_list]


async def _cache_substitutes(
    ingredient: str,
    conditions: list[str],
    substitutes: list[SubstituteOption],
    db: AsyncClient,
) -> None:
    """Upsert substitution results into the cache table."""
    payload = {
        "ingredient_name": ingredient.lower(),
        "context_conditions": conditions,
        "substitutes": [s.model_dump() for s in substitutes],
    }
    await db.table(_CACHE_TABLE).upsert(payload, on_conflict="ingredient_name").execute()


async def _generate_substitutes_with_claude(
    request: SubstitutionRequest,
) -> list[SubstituteOption]:
    """Call Claude to generate substitution options for an ingredient."""
    import json

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    conditions_str = (
        ", ".join(request.health_conditions) if request.health_conditions else "none"
    )
    reason_str = request.reason or "not available locally"

    prompt = (
        f"You are a culinary expert. Suggest substitutes for: **{request.ingredient}**\n\n"
        f"Reason: {reason_str}\n"
        f"User health conditions: {conditions_str}\n\n"
        "Return a JSON array of up to 5 substitutes. Each item must have:\n"
        '{"name": str, "notes": str, "gluten_free": bool, "vegan": bool, "availability_notes": str}\n\n'
        "Respond with ONLY the JSON array."
    )

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        items = json.loads(raw)
        return [SubstituteOption(**item) for item in items]
    except Exception as exc:
        logger.error("Substitution generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "Substitution generation failed",
                "code": "LLM_SUBSTITUTION_ERROR",
                "detail": str(exc),
            },
        ) from exc
