from fastapi import APIRouter, Depends, HTTPException, Request

from ..schemas.heartbeat import Heartbeat, HeartbeatReceipt
from ..schemas.readings import Identifier
from ..security import authenticated_gateway
from ..services.heartbeat import SessionConflict, UnauthorizedNode, receive_heartbeat

router = APIRouter(prefix="/api/v1", tags=["Gateways"])


@router.post("/gateways/{gateway_id}/heartbeat", response_model=HeartbeatReceipt, responses={401: {"description": "Token ausente ou inválido"}, 403: {"description": "Gateway/nó não autorizado"}, 409: {"description": "Conflito de sessão ou conteúdo"}}, summary="Informar comunicação e sessões atuais, sem inserir medições")
def heartbeat(gateway_id: Identifier, body: Heartbeat, request: Request, credential_gateway: str = Depends(authenticated_gateway)) -> dict:
    if gateway_id != credential_gateway:
        raise HTTPException(status_code=403, detail="Gateway da rota não corresponde à credencial.")
    try:
        return receive_heartbeat(request.app.state.database, gateway_id, body)
    except SessionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except UnauthorizedNode as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
