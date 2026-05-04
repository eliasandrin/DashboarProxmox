"""
INFORMIX Spa — Database Configuration
Async SQLAlchemy engine with connection pooling for PostgreSQL / AWS RDS.
Engine creation is LAZY: it happens in init_db() AFTER secrets have been applied.
"""

import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# Lazy engine — created in init_db() after secrets are loaded
engine = None
AsyncSessionLocal = None


async def get_db() -> AsyncSession:
    """FastAPI dependency: yields an async database session."""
    if AsyncSessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def _create_engine():
    """Create the async engine using current settings (called after secrets are applied)."""
    global engine, AsyncSessionLocal

    engine = create_async_engine(
        settings.database_url,
        echo=(settings.APP_ENV == "development"),
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Reconnect on stale connections (important for RDS)
    )

    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    logger.info(f"✅ Database engine created (host: {settings.DB_HOST})")


async def init_db():
    """Create engine and all database tables on startup."""
    _create_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables initialized")


async def close_db():
    """Dispose of the database engine on shutdown."""
    if engine:
        await engine.dispose()
        logger.info("Database engine disposed")
