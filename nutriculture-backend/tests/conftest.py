"""Shared pytest fixtures and test configuration."""

from __future__ import annotations

import os

# Set required env vars before any app module is imported.
# The Settings class reads these at import-time via pydantic-settings.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("ENVIRONMENT", "dev")
os.environ.setdefault("SECRET_KEY", "test-secret-key-32chars-padded!!")

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import app
from app.config import Settings


# ---------------------------------------------------------------------------
# Settings override
# ---------------------------------------------------------------------------

TEST_SETTINGS = Settings(
    SUPABASE_URL="https://test.supabase.co",
    SUPABASE_SERVICE_KEY="test-service-key",
    ANTHROPIC_API_KEY="test-anthropic-key",
    ENVIRONMENT="dev",
    SECRET_KEY="test-secret-key",
)


@pytest.fixture(scope="session")
def anyio_backend():
    """Use asyncio backend for anyio / pytest-asyncio."""
    return "asyncio"


@pytest.fixture
def mock_settings():
    """Override get_settings() to return test settings."""
    with patch("app.config.get_settings", return_value=TEST_SETTINGS):
        yield TEST_SETTINGS


@pytest.fixture
def mock_db():
    """Return a fully mocked Supabase AsyncClient.

    All query-builder chain methods (table, select, eq, …) are regular
    MagicMock so they return synchronously (matching supabase-py's fluent
    builder API).  Only `execute` is an AsyncMock.
    """
    db = MagicMock()

    # Every builder method returns the same mock so chaining works.
    for method in (
        "table", "select", "insert", "upsert", "update", "delete",
        "eq", "neq", "contains", "order", "range", "limit", "single",
    ):
        getattr(db, method).return_value = db

    # Only execute() is async — override per-test via mock_db.execute = AsyncMock(...)
    db.execute = AsyncMock(return_value=MagicMock(data=[], count=0))

    # rpc() is synchronous and returns a builder whose execute() is async.
    _rpc_builder = MagicMock()
    _rpc_builder.execute = AsyncMock(return_value=MagicMock(data=None))
    db.rpc.return_value = _rpc_builder

    return db


@pytest.fixture
def mock_current_user():
    """Return a fake authenticated user dict."""
    return {"id": "user-uuid-1234", "email": "test@example.com"}


@pytest.fixture
async def async_client(mock_db, mock_current_user, mock_settings):
    """Return an httpx AsyncClient wired to the FastAPI app with mocked deps."""
    from app.db.client import get_client
    from app.routers.deps import get_current_user

    # get_client is an async generator — override must also be an async generator
    async def _override_get_client():
        yield mock_db

    app.dependency_overrides[get_client] = _override_get_client
    app.dependency_overrides[get_current_user] = lambda: mock_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
