"""Tests for ingredient store finder and substitution endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.models.ingredients import SubstituteOption


FAKE_OVERPASS_RESPONSE = {
    "elements": [
        {
            "id": 987654,
            "lat": 51.515,
            "lon": -0.120,
            "tags": {
                "name": "Spice World",
                "shop": "ethnic_grocery",
                "addr:street": "Brick Lane",
                "addr:city": "London",
            },
        },
        {
            "id": 111222,
            "lat": 51.510,
            "lon": -0.115,
            "tags": {
                "name": "Fresh Mart",
                "shop": "supermarket",
            },
        },
    ]
}

FAKE_SUBSTITUTES = [
    SubstituteOption(
        name="Dried fenugreek leaves",
        notes="Use 1 tsp dried per 1 tbsp fresh.",
        gluten_free=True,
        vegan=True,
        availability_notes="Available in most South Asian grocery stores.",
    ),
]

STORE_REQUEST = {
    "ingredient": "fenugreek",
    "lat": 51.509865,
    "lng": -0.118092,
    "radius_km": 2.0,
}

SUBSTITUTE_REQUEST = {
    "ingredient": "fenugreek",
    "health_conditions": ["type2_diabetes"],
    "reason": "not available locally",
}


def _make_mock_httpx_client(overpass_data: dict | None = None, raise_exc=None):
    """Build a mock httpx.AsyncClient context manager."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    if raise_exc:
        mock_response.raise_for_status.side_effect = raise_exc

    if overpass_data is not None:
        mock_response.json.return_value = overpass_data

    mock_inner = AsyncMock()
    if raise_exc and isinstance(raise_exc, httpx.TimeoutException):
        mock_inner.post = AsyncMock(side_effect=raise_exc)
    elif raise_exc and isinstance(raise_exc, httpx.HTTPError):
        mock_inner.post = AsyncMock(side_effect=raise_exc)
    else:
        mock_inner.post = AsyncMock(return_value=mock_response)

    mock_cls = MagicMock()
    mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_inner)
    mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_cls


# ---------------------------------------------------------------------------
# POST /api/v1/ingredients/stores
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_find_stores_success(async_client):
    """Store finder should parse Overpass results and return sorted stores."""
    mock_cls = _make_mock_httpx_client(overpass_data=FAKE_OVERPASS_RESPONSE)

    with patch("app.services.ingredient_service.httpx.AsyncClient", mock_cls):
        response = await async_client.post(
            "/api/v1/ingredients/stores", json=STORE_REQUEST
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ingredient"] == "fenugreek"
    assert data["total_found"] == 2
    # Results should be sorted by distance (closest first)
    distances = [s["distance_km"] for s in data["stores"]]
    assert distances == sorted(distances)


@pytest.mark.asyncio
async def test_find_stores_overpass_timeout_returns_504(async_client):
    """A timeout from the Overpass API should return 504."""
    mock_cls = _make_mock_httpx_client(raise_exc=httpx.TimeoutException("timeout"))

    with patch("app.services.ingredient_service.httpx.AsyncClient", mock_cls):
        response = await async_client.post(
            "/api/v1/ingredients/stores", json=STORE_REQUEST
        )

    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "OVERPASS_TIMEOUT"


@pytest.mark.asyncio
async def test_find_stores_empty_results(async_client):
    """No nearby stores should return an empty list with total_found=0."""
    mock_cls = _make_mock_httpx_client(overpass_data={"elements": []})

    with patch("app.services.ingredient_service.httpx.AsyncClient", mock_cls):
        response = await async_client.post(
            "/api/v1/ingredients/stores", json=STORE_REQUEST
        )

    assert response.status_code == 200
    data = response.json()
    assert data["total_found"] == 0
    assert data["stores"] == []


# ---------------------------------------------------------------------------
# POST /api/v1/ingredients/substitute
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_substitutes_cache_hit(async_client, mock_db):
    """A cached substitution result should be returned without calling Claude."""
    cached_data = {"substitutes": [s.model_dump() for s in FAKE_SUBSTITUTES]}
    mock_db.execute = AsyncMock(return_value=MagicMock(data=cached_data))

    response = await async_client.post(
        "/api/v1/ingredients/substitute", json=SUBSTITUTE_REQUEST
    )

    assert response.status_code == 200
    data = response.json()
    assert data["cached"] is True
    assert len(data["substitutes"]) == 1
    assert data["substitutes"][0]["name"] == "Dried fenugreek leaves"


@pytest.mark.asyncio
async def test_get_substitutes_cache_miss_calls_claude(async_client, mock_db):
    """A cache miss should call Claude and cache the result."""
    # First execute: cache miss (single() returns None)
    # Second execute: upsert cache (no return value needed)
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(data=None),   # cache lookup miss
            MagicMock(data=[]),     # cache upsert
        ]
    )

    with patch(
        "app.services.ingredient_service._generate_substitutes_with_claude",
        new_callable=AsyncMock,
        return_value=FAKE_SUBSTITUTES,
    ):
        response = await async_client.post(
            "/api/v1/ingredients/substitute", json=SUBSTITUTE_REQUEST
        )

    assert response.status_code == 200
    data = response.json()
    assert data["cached"] is False
    assert len(data["substitutes"]) == 1


# ---------------------------------------------------------------------------
# Haversine distance unit tests
# ---------------------------------------------------------------------------


def test_haversine_zero_distance():
    """Same coordinates should return 0 km."""
    from app.services.ingredient_service import _haversine_km
    assert _haversine_km(51.5, -0.1, 51.5, -0.1) == 0.0


def test_haversine_known_distance():
    """London to Paris is approximately 340 km."""
    from app.services.ingredient_service import _haversine_km
    distance = _haversine_km(51.5074, -0.1278, 48.8566, 2.3522)
    assert 330 < distance < 350
