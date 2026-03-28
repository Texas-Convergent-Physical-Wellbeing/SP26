"""User profile router — /api/v1/users."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from supabase._async.client import AsyncClient

from app.db.client import get_client
from app.models.user import (
    MacroTargetsResponse,
    UserProfileResponse,
    UserProfileUpsertRequest,
    MacroTargets,
)
from app.routers.deps import get_current_user
from app.services import user_service

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.put(
    "/profile",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Create or update the current user's health profile",
)
async def upsert_profile(
    request: UserProfileUpsertRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> UserProfileResponse:
    """Upsert the authenticated user's health profile.

    Automatically computes and stores BMR, TDEE, and condition-specific macro
    targets whenever the profile is created or updated.
    """
    return await user_service.create_or_update_profile(
        user_id=current_user["id"],
        request=request,
        db=db,
    )


@router.get(
    "/profile",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the current user's health profile",
)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> UserProfileResponse:
    """Return the authenticated user's full health profile."""
    return await user_service.get_profile(user_id=current_user["id"], db=db)


@router.get(
    "/profile/macros",
    response_model=MacroTargetsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the current user's computed macro targets",
)
async def get_macro_targets(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> MacroTargetsResponse:
    """Return just the macro targets and TDEE for the authenticated user."""
    profile = await user_service.get_profile(user_id=current_user["id"], db=db)
    return MacroTargetsResponse(
        macro_targets=MacroTargets(**profile.macro_targets.model_dump()),
        tdee=profile.tdee or 0.0,
    )
