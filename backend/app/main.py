"""Factory FastAPI: configuração, catálogo e ingestão autenticada."""

import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings, load_settings
from .database import Database
from .middleware import BodyLimitMiddleware
from .routers.health import router as health_router
from .routers.profiles import router as profiles_router
from .routers.readings import router as readings_router
from .routers.devices import router as devices_router
from .routers.gateways import router as gateways_router
from .routers.alerts import router as alerts_router
from .routers.notifications import router as notifications_router

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    database = Database(settings.database_path, settings.sqlite_timeout_seconds)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database.initialize()
        yield

    app = FastAPI(title="API de Monitoramento", version="0.5.0", description="Backend MVP: ingestão, histórico, sessões, alertas e fila persistente para o bot. O envio Telegram é feito pelo worker externo.", lifespan=lifespan)
    app.state.database = database
    app.state.settings = settings
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"], allow_credentials=False)
    app.include_router(health_router)
    app.include_router(profiles_router)
    app.include_router(readings_router)
    app.include_router(devices_router)
    app.include_router(gateways_router)
    app.include_router(alerts_router)
    app.include_router(notifications_router)

    @app.get("/", tags=["Operação"], summary="Identificar a API e seus pontos de entrada")
    def index() -> dict:
        return {"service": "monitoring-api", "version": app.version, "docs": "/docs", "health": "/health"}

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        # Não ecoar dados de entrada, inclusive números JSON não finitos, na resposta.
        errors = [{"loc": error["loc"], "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
        return JSONResponse({"detail": errors}, status_code=422)

    @app.exception_handler(sqlite3.Error)
    async def unavailable_database(request: Request, exc: sqlite3.Error):
        logger.error("Falha de banco ao atender requisição.", exc_info=exc)
        return JSONResponse({"detail": "Banco indisponível; nenhuma confirmação de gravação foi emitida."}, status_code=503)

    return app


app = create_app()
