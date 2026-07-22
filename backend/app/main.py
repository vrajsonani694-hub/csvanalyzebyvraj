from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analysis, health, ml, reports, uploads
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import init_db

configure_logging()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    init_db()
    log.info("service.start version=%s env=%s", settings.version, settings.environment)
    yield
    log.info("service.stop")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="CSV Analyzer Pro by Vraj API",
        version=settings.version,
        description="REST API for CSV upload, statistical analysis, ML training, and report generation.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, prefix="/api")
    app.include_router(uploads.router, prefix="/api")
    app.include_router(analysis.router, prefix="/api")
    app.include_router(ml.router, prefix="/api")
    app.include_router(reports.router, prefix="/api")
    return app


app = create_app()
