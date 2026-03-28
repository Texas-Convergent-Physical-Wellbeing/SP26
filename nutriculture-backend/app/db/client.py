"""Supabase async client singleton and FastAPI dependency."""

from __future__ import annotations

import logging
from typing import AsyncGenerator

from supabase._async.client import AsyncClient, create_client
from fastapi import Depends, HTTPException, status

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Module-level singleton — initialised once on first call to get_client().
_supabase_client: AsyncClient | None = None


async def init_supabase_client(settings: Settings) -> AsyncClient:
    """Create and cache the Supabase AsyncClient using the service-role key.

    The service-role key bypasses RLS for backend-initiated writes (e.g.,
    counter updates, community_verified flag).  It must never be forwarded
    to client consumers.
    """
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = await create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
        )
        logger.info("Supabase AsyncClient initialised.")
    return _supabase_client


async def close_supabase_client() -> None:
    """Nullify the cached client reference on application shutdown."""
    global _supabase_client
    _supabase_client = None
    logger.info("Supabase client reference cleared.")


async def get_client(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI dependency that yields the Supabase AsyncClient.

    Usage::

        @router.get("/example")
        async def handler(db: AsyncClient = Depends(get_client)):
            ...
    """
    client = await init_supabase_client(settings)
    yield client


async def health_check(settings: Settings) -> dict[str, str]:
    """Ping Supabase to verify connectivity.

    Returns a dict with key ``db`` set to ``"ok"`` or ``"error: <message>"``.
    """
    try:
        client = await init_supabase_client(settings)
        # A lightweight query against a system table to confirm reachability.
        await client.table("user_profiles").select("id").limit(1).execute()
        return {"db": "ok"}
    except Exception as exc:  # noqa: BLE001
        logger.error("Supabase health check failed: %s", exc)
        return {"db": f"error: {exc}"}
