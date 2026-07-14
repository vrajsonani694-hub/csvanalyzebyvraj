from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ACAP_", extra="ignore")

    environment: str = "development"
    version: str = "1.0.0"
    database_url: str = "sqlite:///./data/analyzer.db"
    upload_dir: Path = Path("./data/uploads")
    max_upload_bytes: int = 100 * 1024 * 1024
    allowed_extensions: tuple[str, ...] = (".csv",)
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://localhost:8080"])
    rate_limit_per_minute: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
