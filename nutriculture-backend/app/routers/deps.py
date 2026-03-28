"""Shared FastAPI dependencies: authentication, DB client injection."""

from __future__ import annotations

import logging

from fastapi import Depends, Header, HTTPException, status
from supabase._async.client import AsyncClient

from app.db.client import get_client

logger = logging.getLogger(__name__)


async def get_current_user(
    authorization: str = Header(..., description="Bearer <supabase_jwt>"),
    db: AsyncClient = Depends(get_client),
) -> dict:
    """Validate the Supabase JWT from the Authorization header.

    Calls ``auth.get_user()`` on the Supabase client which validates the JWT
    against the Supabase project's secret and returns the user record.

    Args:
        authorization: Raw ``Authorization`` header value (``"Bearer <token>"``).
        db: Injected Supabase async client.

    Returns:
        The Supabase user dict containing at least ``{"id": "<uuid>", ...}``.

    Raises:
        HTTPException: 401 if the token is missing, malformed, or invalid.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Invalid authorization header",
                "code": "AUTH_HEADER_MALFORMED",
                "detail": "Authorization header must be 'Bearer <token>'.",
            },
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Missing token",
                "code": "AUTH_TOKEN_MISSING",
                "detail": "No JWT token provided.",
            },
        )

    try:
        user_response = await db.auth.get_user(token)
        if not user_response or not user_response.user:
            raise ValueError("Empty user response")
        return {"id": str(user_response.user.id), "email": user_response.user.email}
    except Exception as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Invalid or expired token",
                "code": "AUTH_TOKEN_INVALID",
                "detail": "Your session has expired or the token is invalid. Please log in again.",
            },
        ) from exc
