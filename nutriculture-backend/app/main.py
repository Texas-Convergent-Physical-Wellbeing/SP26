"""NutriCulture FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db.client import close_supabase_client, health_check, init_supabase_client
from app.routers import chat, community, cookbook, meal_plans, taste, users

logger = logging.getLogger(__name__)

APP_VERSION = "1.0.0"


# ---------------------------------------------------------------------------
# Lifespan context manager
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown lifecycle events.

    On startup: initialises the Supabase client and verifies connectivity.
    On shutdown: nullifies the cached client reference.
    """
    settings = get_settings()
    logger.info("NutriCulture backend starting up (env=%s).", settings.ENVIRONMENT)

    await init_supabase_client(settings)
    ping = await health_check(settings)
    if "error" in ping["db"]:
        logger.critical("Supabase unreachable on startup: %s", ping["db"])
    else:
        logger.info("Supabase connection verified.")

    yield

    logger.info("NutriCulture backend shutting down.")
    await close_supabase_client()


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application instance.

    Returns:
        Fully configured ``FastAPI`` application.
    """
    settings = get_settings()

    app = FastAPI(
        title="NutriCulture API",
        version=APP_VERSION,
        description=(
            "Culturally-aware, condition-specific AI meal planning platform. "
            "Generates personalised daily meal plans that respect cultural cuisine "
            "identity while adapting to chronic health conditions."
        ),
        lifespan=lifespan,
        docs_url="/docs" if settings.ENVIRONMENT == "dev" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT == "dev" else None,
        # Disable automatic trailing-slash redirects.
        # 307 redirects strip the Authorization header on some React Native
        # fetch implementations, so clients must use exact paths as documented.
        redirect_slashes=False,
    )

    # GZip compresses responses ≥ 500 bytes — reduces meal plan payload by ~70%
    # on slow mobile networks (typical plan: ~12 KB → ~3 KB compressed).
    app.add_middleware(GZipMiddleware, minimum_size=500)
    _configure_cors(app, settings)
    _register_exception_handlers(app)
    _include_routers(app)

    return app


def _configure_cors(app: FastAPI, settings) -> None:
    """Add CORSMiddleware with origins sourced from environment config."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers for unhandled errors."""

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Catch-all handler — returns structured JSON for unexpected errors."""
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "code": "INTERNAL_ERROR",
                "detail": "An unexpected error occurred. Please try again later.",
            },
        )


def _include_routers(app: FastAPI) -> None:
    """Register all domain routers."""
    app.include_router(users.router)
    app.include_router(meal_plans.router)
    app.include_router(chat.router)
    app.include_router(community.router)
    app.include_router(taste.router)
    app.include_router(cookbook.router)


# ---------------------------------------------------------------------------
# Health check endpoint
# ---------------------------------------------------------------------------

app = create_app()


@app.get(
    "/health",
    status_code=status.HTTP_200_OK,
    tags=["health"],
    summary="Application and database health check",
)
async def health() -> dict:
    """Return the health status of the API and its Supabase dependency."""
    settings = get_settings()
    db_status = await health_check(settings)
    return {
        "status": "ok",
        "db": db_status["db"],
        "version": APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }
