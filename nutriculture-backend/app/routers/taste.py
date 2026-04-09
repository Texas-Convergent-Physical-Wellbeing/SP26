"""Taste learning router — /api/v1/taste."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from supabase._async.client import AsyncClient

from app.db.client import get_client
from app.models.taste import FeedbackResponse, SubmitFeedbackRequest, TastePreferenceSummary
from app.routers.deps import get_current_user
from app.services import taste_service

router = APIRouter(prefix="/api/v1/taste", tags=["taste-learning"])


@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit feedback on a generated meal (saved / skipped / modified)",
)
async def submit_feedback(
    request: SubmitFeedbackRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> FeedbackResponse:
    """Record the user's reaction to a specific meal from a generated plan.

    This feedback is used to adapt future meal plan generation — Claude reads
    recent saved/skipped/modified signals to avoid disliked dishes and lean
    toward preferred styles.
    """
    return await taste_service.submit_feedback(
        user_id=current_user["id"],
        request=request,
        db=db,
    )


@router.get(
    "/preferences",
    response_model=TastePreferenceSummary,
    status_code=status.HTTP_200_OK,
    summary="Get Claude-inferred taste preference summary",
)
async def get_preferences(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> TastePreferenceSummary:
    """Return a Claude-generated summary of the user's inferred taste preferences.

    Analyses recent meal feedback to identify sub-cuisine leanings,
    avoided ingredients, and preferred cooking styles.
    Requires at least one feedback entry to have been submitted.
    """
    return await taste_service.get_preference_summary(
        user_id=current_user["id"],
        db=db,
    )
