"""Application configuration loaded from environment variables via pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All required application settings sourced from environment variables.

    Each field maps to an env var of the same name (case-insensitive).
    The application will fail fast on startup if any required var is absent.
    """

    # Supabase
    SUPABASE_URL: str
    """Full Supabase project URL, e.g. https://<project>.supabase.co"""

    SUPABASE_SERVICE_KEY: str
    """Supabase service-role key (bypasses RLS — never expose to clients)."""

    # Anthropic
    ANTHROPIC_API_KEY: str
    """Anthropic API key for Claude requests."""

    # App
    ENVIRONMENT: Literal["dev", "prod"] = "dev"
    """Deployment environment. Controls logging verbosity and CORS strictness."""

    SECRET_KEY: str
    """Random secret used for signing internal tokens / session material."""

    CORS_ORIGINS: str = "*"
    """Comma-separated list of allowed CORS origins, or '*' for open access (dev only).
    Not enforced by native mobile builds but required for Expo Go web preview."""

    LLM_TIMEOUT_SECONDS: int = 60
    """Max seconds to wait for a Claude response before returning 504.
    Claude meal-plan generation typically takes 15–30 s on claude-sonnet-4-6."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a list of origin strings."""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings singleton.

    Use as a FastAPI dependency: ``Depends(get_settings)``.
    The cache ensures env vars are parsed only once per process.
    """
    return Settings()
