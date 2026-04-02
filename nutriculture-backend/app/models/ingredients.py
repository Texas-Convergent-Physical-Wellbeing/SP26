"""Pydantic models for ingredient store finder and substitution endpoints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Store finder
# ---------------------------------------------------------------------------


class StoreFinderRequest(BaseModel):
    """Payload for POST /api/v1/ingredients/stores."""

    ingredient: str = Field(
        ...,
        description="Cultural ingredient to search for (e.g. 'teff', 'pandan leaves')",
    )
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=5.0, gt=0, le=50)


class StoreResult(BaseModel):
    """A single store returned by the store finder."""

    name: str
    address: Optional[str]
    lat: float
    lng: float
    distance_km: float
    store_type: Optional[str]
    """OSM shop tag value e.g. 'supermarket', 'convenience', 'greengrocer'."""
    osm_id: Optional[str]


class StoreFinderResponse(BaseModel):
    """Response from the store finder endpoint."""

    ingredient: str
    stores: list[StoreResult]
    total_found: int
    radius_km: float
    source: str = "OpenStreetMap (Overpass API)"


# ---------------------------------------------------------------------------
# Substitutions
# ---------------------------------------------------------------------------


class SubstitutionRequest(BaseModel):
    """Payload for POST /api/v1/ingredients/substitute."""

    ingredient: str = Field(
        ...,
        description="Ingredient to find substitutes for",
    )
    health_conditions: list[str] = Field(
        default_factory=list,
        description="User's active health conditions to filter substitutes",
    )
    reason: Optional[str] = Field(
        None,
        description="Why the substitute is needed e.g. 'not available locally', 'allergy'",
    )


class SubstituteOption(BaseModel):
    """A single substitute suggestion."""

    name: str
    notes: str
    """How to use it as a substitute and any ratio adjustments."""
    gluten_free: bool = False
    vegan: bool = False
    availability_notes: Optional[str] = None
    """Notes on how commonly available this substitute is."""


class SubstitutionResponse(BaseModel):
    """Response from the substitution endpoint."""

    ingredient: str
    substitutes: list[SubstituteOption]
    cached: bool = False
    """True if this response was served from the substitution cache."""
