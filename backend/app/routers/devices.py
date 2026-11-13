from fastapi import APIRouter, HTTPException, Request

from ..schemas.readings import Identifier
from ..schemas.devices import Devices, LatestReadings
from ..services.devices import latest_readings, list_devices

router = APIRouter(prefix="/api/v1", tags=["Dispositivos"])


@router.get("/devices", response_model=Devices, summary="Listar gateways, nós e canais cadastrados")
def devices(request: Request) -> dict:
    return list_devices(request.app.state.database, request.app.state.settings.stale_after_seconds)


@router.get("/devices/{node_id}/latest", response_model=LatestReadings, responses={404: {"description": "Nó não cadastrado"}}, summary="Última leitura conhecida por canal e qualidade da recência")
def latest(node_id: Identifier, request: Request) -> dict:
    result = latest_readings(request.app.state.database, node_id, request.app.state.settings.stale_after_seconds)
    if result is None:
        raise HTTPException(status_code=404, detail="Nó não cadastrado.")
    return result
