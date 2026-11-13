from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..schemas.notifications import BotConfig, Claim, ClaimResult, Delivered, Failed, NotificationList, Settlement
from ..schemas.readings import Identifier
from ..security import authenticated_bot
from ..services.notifications import BotNotConfigured, LeaseConflict, NotificationMissing, claim, list_notifications, settle

router=APIRouter(prefix='/api/v1/internal',tags=['Bot e notificações'],dependencies=[Depends(authenticated_bot)])


@router.get('/bot-config',response_model=BotConfig,summary='Configuração do chat autorizado e link do painel')
def bot_config(request: Request) -> dict:
    settings=request.app.state.settings
    return {'authorized_chat_id':settings.authorized_telegram_chat_id,'dashboard_url':settings.dashboard_url,'lease_seconds':settings.notification_lease_seconds}


@router.get('/notifications',response_model=NotificationList,summary='Diagnóstico da fila; restrito ao serviço do bot')
def notifications(request: Request,status: Literal['pending','leased','sent','dead'] | None=None,limit: int=Query(100,ge=1,le=500)) -> dict:
    return list_notifications(request.app.state.database,status,limit)


@router.post('/notifications/claim',response_model=ClaimResult,summary='Reservar notificações, sem enviá-las ao Telegram')
def reserve(body: Claim,request: Request) -> dict:
    try:
        return claim(request.app.state.database,request.app.state.settings,body)
    except BotNotConfigured as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc


def acknowledge(identifier,body,request,action):
    try:
        return settle(request.app.state.database,request.app.state.settings,identifier,body,action)
    except NotificationMissing as exc:
        raise HTTPException(status_code=404,detail=str(exc)) from exc
    except LeaseConflict as exc:
        raise HTTPException(status_code=409,detail=str(exc)) from exc


@router.post('/notifications/{notification_id}/delivered',response_model=Settlement,summary='Confirmar envio realizado pelo bot')
def delivered(notification_id: Identifier,body: Delivered,request: Request) -> dict:
    return acknowledge(notification_id,body,request,'delivered')


@router.post('/notifications/{notification_id}/failed',response_model=Settlement,summary='Registrar falha e agendar retry ou encerrar tentativas')
def failed(notification_id: Identifier,body: Failed,request: Request) -> dict:
    return acknowledge(notification_id,body,request,'failed')
