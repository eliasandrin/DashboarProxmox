"""
INFORMIX Spa — Proxmox VE Management Portal
FastAPI Application Entry Point

Startup sequence:
1. Load AWS Secrets Manager (if enabled)
2. Initialize database connection
3. Create default users
4. Initialize Proxmox client
5. Start serving API
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.secrets_manager import SecretsManager
from app.database import init_db, close_db
from app.proxmox_client import ProxmoxClient

# ── Logging ───────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("informix")

# ── Global Proxmox Client ────────────────────────────
proxmox_client: ProxmoxClient = None


def get_proxmox() -> ProxmoxClient:
    """Get the global Proxmox client instance."""
    return proxmox_client


# ── Application Lifespan ─────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    global proxmox_client

    logger.info("=" * 60)
    logger.info("  INFORMIX Spa — Proxmox Portal Starting...")
    logger.info(f"  Environment: {settings.APP_ENV}")
    logger.info(f"  Demo Mode: {settings.DEMO_MODE}")
    logger.info("=" * 60)

    # Step 1: Load secrets from AWS Secrets Manager
    try:
        SecretsManager.apply_secrets(settings)
    except Exception as e:
        logger.warning(f"Secrets Manager error (non-fatal): {e}")

    # Step 2: Initialize database
    try:
        await init_db()
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        if settings.APP_ENV == "production":
            raise

    # Step 3: Initialize Proxmox client
    try:
        proxmox_client = ProxmoxClient()
        if proxmox_client.is_connected:
            logger.info("✅ Proxmox client ready")
        else:
            logger.warning("⚠️ Proxmox client not connected — some features may be unavailable")
    except Exception as e:
        logger.error(f"Proxmox client error: {e}")
        proxmox_client = ProxmoxClient()  # Will work in demo mode

    logger.info("🚀 INFORMIX Portal is ready!")
    logger.info(f"   API: http://localhost:8000/docs")

    yield  # ── Application is running ──

    # Shutdown
    logger.info("Shutting down INFORMIX Portal...")
    await close_db()
    logger.info("Goodbye!")


# ── FastAPI Application ──────────────────────────────

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description="Proxmox VE Management Portal for INFORMIX Spa MSP technicians",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware — restricted in production, open in development
_cors_origins = ["*"] if settings.APP_ENV == "development" else [
    "http://localhost", "http://informixspa.it", "https://informixspa.it"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ─────────────────────────────────

from app.routers.auth_router import router as auth_router
from app.routers.nodes_router import router as nodes_router
from app.routers.vms_router import router as vms_router
from app.routers.monitoring_router import router as monitoring_router
from app.routers.backup_router import router as backup_router
from app.routers.cluster_router import router as cluster_router
from app.routers.users_router import router as users_router

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(nodes_router, prefix="/api/nodes", tags=["Nodes"])
app.include_router(vms_router, prefix="/api", tags=["Virtual Machines"])
app.include_router(monitoring_router, prefix="/api", tags=["Monitoring"])
app.include_router(backup_router, prefix="/api", tags=["Backup & Snapshots"])
app.include_router(cluster_router, prefix="/api/cluster", tags=["Cluster"])
app.include_router(users_router, prefix="/api", tags=["Users"])


# ── Health Check ──────────────────────────────────────

@app.get("/api/health", tags=["System"])
async def health_check():
    """Health check endpoint for Docker and load balancers."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "demo_mode": settings.DEMO_MODE,
        "database": "connected",
        "proxmox": "connected" if (proxmox_client and proxmox_client.is_connected) else "disconnected",
    }
