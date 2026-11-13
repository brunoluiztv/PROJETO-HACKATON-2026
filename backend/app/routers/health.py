from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..services.health import check_health

router = APIRouter(tags=["Operação"])


class HealthResponse(BaseModel):
    status: Literal["ok", "unavailable"]
    database: Literal["ok", "unavailable"]
    schema_version: int | None


@router.get("/health", response_model=HealthResponse, responses={503: {"model": HealthResponse}}, summary="Verificar API e banco")
def health(request: Request):
    body, status = check_health(request.app.state.database)
    return JSONResponse(content=body, status_code=status)
