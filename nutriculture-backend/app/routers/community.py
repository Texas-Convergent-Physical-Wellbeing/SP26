"""Community router — /api/v1/community."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, status
from supabase._async.client import AsyncClient

from app.db.client import get_client
from app.models.community import (
    AddCommentRequest,
    CommentResponse,
    CommunityPostListResponse,
    CommunityPostResponse,
    CreatePostRequest,
    DeleteInteractionResult,
    InteractRequest,
    InteractionResult,
)
from app.routers.deps import get_current_user
from app.services import community_service

router = APIRouter(prefix="/api/v1/community", tags=["community"])


@router.post(
    "/posts",
    response_model=CommunityPostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new community post",
)
async def create_post(
    request: CreatePostRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> CommunityPostResponse:
    """Publish a new community recipe post authored by the current user."""
    return await community_service.create_post(
        author_id=current_user["id"],
        request=request,
        db=db,
    )


@router.get(
    "/posts",
    response_model=CommunityPostListResponse,
    status_code=status.HTTP_200_OK,
    summary="List community posts with optional filters",
)
async def list_posts(
    condition: Optional[str] = Query(None, description="Filter by health condition tag"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine tag"),
    verified_only: bool = Query(False, description="Return only community-verified posts"),
    sort: Literal["recent", "upvotes"] = Query("recent", description="Sort order"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> CommunityPostListResponse:
    """Return a filtered, sorted, paginated feed of community posts."""
    return await community_service.list_posts(
        db=db,
        condition=condition,
        cuisine=cuisine,
        verified_only=verified_only,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/posts/{post_id}",
    response_model=CommunityPostResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a single community post",
)
async def get_post(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> CommunityPostResponse:
    """Fetch a community post by its UUID."""
    return await community_service.get_post(post_id=post_id, db=db)


@router.post(
    "/posts/{post_id}/interact",
    response_model=InteractionResult,
    status_code=status.HTTP_200_OK,
    summary="Add or toggle an interaction on a post",
)
async def interact_with_post(
    post_id: str,
    request: InteractRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> InteractionResult:
    """Toggle upvote/bookmark (or record tried_it once).

    - upvote / bookmark: subsequent calls toggle the interaction off.
    - tried_it: write-once; submitting again returns HTTP 409.
    """
    macro_dict = request.macro_confirmation.model_dump() if request.macro_confirmation else None
    return await community_service.toggle_interaction(
        user_id=current_user["id"],
        post_id=post_id,
        interaction_type=request.type,
        db=db,
        macro_confirmation=macro_dict,
    )


@router.delete(
    "/posts/{post_id}/interact",
    response_model=DeleteInteractionResult,
    status_code=status.HTTP_200_OK,
    summary="Remove an upvote or bookmark",
)
async def remove_interaction(
    post_id: str,
    interaction_type: Literal["upvote", "bookmark"] = Query(
        ..., description="The interaction type to remove"
    ),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> DeleteInteractionResult:
    """Explicitly remove an existing upvote or bookmark."""
    return await community_service.remove_interaction(
        user_id=current_user["id"],
        post_id=post_id,
        interaction_type=interaction_type,
        db=db,
    )


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to a community post",
)
async def add_comment(
    post_id: str,
    request: AddCommentRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> CommentResponse:
    """Post a top-level comment or a threaded reply on a community post."""
    return await community_service.add_comment(
        author_id=current_user["id"],
        post_id=post_id,
        body=request.body,
        parent_comment_id=request.parent_comment_id,
        db=db,
    )


@router.get(
    "/posts/{post_id}/comments",
    response_model=list[CommentResponse],
    status_code=status.HTTP_200_OK,
    summary="List comments for a community post (threaded)",
)
async def list_comments(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_client),
) -> list[CommentResponse]:
    """Return all comments for a post as a threaded tree (parents with nested replies)."""
    return await community_service.list_comments(post_id=post_id, db=db)
