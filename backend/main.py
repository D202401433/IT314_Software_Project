import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db
from app.config import get_settings
from app.errors import install_error_handlers
from app.routers import auth
from app.routers.dm import router as dm_router
from app.services.dispatch import escalate_overdue

logger = logging.getLogger("drch.backend")
logging.basicConfig(level=logging.INFO)

WORKER_INTERVAL_SECONDS = 60


async def ai_workers_background_consumer():
    """
    In-process worker consumer loop:
    Runs concurrently with the FastAPI gateway to handle background tasks
    without requiring a separate paid cloud worker instance.
    Currently: escalates dispatches left unacknowledged past the timeout (DM-NFR-13).
    """
    logger.info("Initializing in-process GenAI Triage & Emergency Worker...")
    try:
        while True:
            await asyncio.sleep(WORKER_INTERVAL_SECONDS)
            if not get_settings().database_url:
                continue
            try:
                await asyncio.to_thread(escalate_overdue)
            except Exception:
                logger.exception("Dispatch escalation check failed; will retry")
    except asyncio.CancelledError:
        logger.info("AI Worker consumer stopped gracefully.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: spawn worker task in background
    worker_task = asyncio.create_task(ai_workers_background_consumer())
    yield
    # Shutdown: cancel worker task
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    db.close_pool()


app = FastAPI(
    title="DRCH API Gateway & Workers",
    version="1.0.0",
    lifespan=lifespan
)
install_error_handlers(app)
app.include_router(auth.router)
app.include_router(dm_router)


@app.get('/')
def read_root():
    return {'message': 'DRCH API Gateway & In-Process AI Worker are running'}


@app.get('/health')
def health_check():
    return {'status': 'healthy', 'service': 'drch-backend'}


@app.get('/api/v1/health')
def api_health():
    """Liveness plus database reachability (SRS s.15.6)."""
    database = "not_configured"
    if get_settings().database_url:
        try:
            with db.transaction() as conn:
                conn.execute("SELECT 1")
            database = "ok"
        except Exception:
            logger.exception("Database health check failed")
            database = "unavailable"
    return {'status': 'healthy', 'service': 'drch-backend', 'database': database}
