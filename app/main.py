import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    audit,
    auth,
    catalog,
    email_settings,
    inventory,
    jobs,
    latest_zfg,
    mop_data,
    reports,
    seller_mapping,
    users,
)
from app.core.config import get_settings
from app.db.schema import ensure_all_tables

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("mop_tracker")

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "avatars").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_all_tables()

    from app.services.scrape_orchestrator import ensure_reactor_installed
    from app.services.scheduler import start_scheduler

    ensure_reactor_installed()
    scheduler = start_scheduler()
    logger.info("MOP Tracker API started.")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="MOP Tracker API", version="1.0.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(mop_data.router)
app.include_router(jobs.router)
app.include_router(reports.router)
app.include_router(seller_mapping.router)
app.include_router(email_settings.router)
app.include_router(inventory.router)
app.include_router(latest_zfg.router)
app.include_router(audit.router)
app.include_router(catalog.router)


@app.get("/health")
def health():
    return {"status": "ok"}
