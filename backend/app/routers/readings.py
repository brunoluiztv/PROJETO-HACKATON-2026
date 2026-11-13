from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError

from ..schemas.readings import BatchReceipt, ReadingBatch
from ..schemas.queries import HistoryFilters, ReadingPage
from ..security import authenticated_gateway
from ..services.ingestion import ingest
from ..services.history import list_readings

router = APIRouter(prefix="/api/v1", tags=["Leituras"])


@router.get("/readings", response_model=ReadingPage, summary="Consultar histórico por nó/canal, período e origem")
def history(
    request: Request,
    node_id: str | None = Query(None, min_length=1, max_length=80),
    channel_id: str | None = Query(None, min_length=1, max_length=80),
    from_: str | None = Query(None, alias="from", max_length=64),
    to: str | None = Query(None, max_length=64),
    time_quality: Literal["synchronized", "unknown"] | None = None,
    source: Literal["simulation", "physical_sensor"] | None = None,
    limit: int = Query(100, ge=1, le=500),
    cursor: str | None = Query(None, min_length=1, max_length=2048),
):
    try:
        filters = HistoryFilters(node_id=node_id, channel_id=channel_id, from_at=from_, to_at=to, time_quality=time_quality, source=source)
        return list_readings(request.app.state.database, filters, limit, cursor)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Filtros inválidos: confira IDs, intervalo e horários ISO com fuso.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/readings", response_model=BatchReceipt, response_model_exclude_none=True, responses={401: {"description": "Token ausente ou inválido"}, 403: {"description": "Gateway incompatível com o token"}, 413: {"description": "Corpo acima de 32 KiB"}, 503: {"description": "Banco indisponível"}}, summary="Receber até 32 leituras")
def receive_readings(batch: ReadingBatch, request: Request, gateway_id: str = Depends(authenticated_gateway)):
    if batch.gateway_id != gateway_id:
        raise HTTPException(status_code=403, detail="Gateway do lote não corresponde à credencial.")
    return ingest(request.app.state.database, batch)
