"""
INFORMIX Spa — Application Configuration
Uses pydantic-settings for environment variable management.
Sensitive values are loaded from AWS Secrets Manager in production.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Application ───────────────────────────────────
    APP_ENV: str = "development"
    DEMO_MODE: bool = True
    APP_TITLE: str = "INFORMIX Proxmox Portal"
    APP_VERSION: str = "1.0.0"

    # ── Database ──────────────────────────────────────
    DB_HOST: str = "db"
    DB_PORT: int = 5432
    DB_NAME: str = "informix_portal"
    DB_USER: str = "informix_admin"
    DB_PASSWORD: str = ""

    # ── JWT ────────────────────────────────────────────
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # ── Proxmox ───────────────────────────────────────
    PROXMOX_HOST: str = "192.168.1.100"
    PROXMOX_PORT: int = 8006
    PROXMOX_USER: str = "apiuser@pve!portal-token"
    PROXMOX_TOKEN_VALUE: str = ""
    PROXMOX_VERIFY_SSL: bool = False
    BACKUP_STORAGE_DEFAULT: str = "local"

    # ── AWS ────────────────────────────────────────────
    AWS_REGION: str = "eu-south-1"
    AWS_SECRET_NAME: str = "informix/portal/config"
    USE_AWS_SECRETS: bool = False

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
