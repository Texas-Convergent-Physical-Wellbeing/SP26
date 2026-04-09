"""Meal plans router — /api/v1/meal-plans."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from supabase._async.client import AsyncClient

from app.db.client import get_client
from app.models.meal_plan import (
    GenerateMealPlanRequest,
    MealPlanListResponse,
    MealPlanResponse,
)
from app.routers.deps import get_current_user
from app.services import meal_plan_service

router = APIRouter(prefix="/api/v1/meal-plans", tags=["meal-plans"])


@router.post(
    "/generate",
    response_model=MealPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new AI meal plan for a given date",
)
async def generate_meal_plan(
    request: GenerateMealPlanRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> MealPlanResponse:
    """Trigger AI generation of a full daily meal plan.

    Fetches the user's health profile, builds a culturally-aware prompt,
    calls Claude, validates the response, and stores the plan.  Overwrites
    any existing plan for the same date.
    """
    return await meal_plan_service.generate_and_store_plan(
        user_id=current_user["id"],
        plan_date=request.plan_date,
        db=db,
    )


@router.get(
    "/{plan_date}",
    response_model=MealPlanResponse,
    status_code=status.HTTP_200_OK,
    summary="Get stored meal plan for a specific date",
)
async def get_meal_plan(
    plan_date: date,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> MealPlanResponse:
    """Retrieve a previously generated meal plan by date (ISO-8601 format)."""
    return await meal_plan_service.get_plan(
        user_id=current_user["id"],
        plan_date=plan_date,
        db=db,
    )


@router.get(
    "",
    response_model=MealPlanListResponse,
    status_code=status.HTTP_200_OK,
    summary="List meal plans with pagination",
)
async def list_meal_plans(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> MealPlanListResponse:
    """Return a paginated list of the current user's meal plans, newest first."""
    return await meal_plan_service.list_plans(
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
        db=db,
    )
