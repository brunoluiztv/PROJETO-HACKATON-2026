from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request

from ..schemas.readings import Identifier
from ..schemas.alerts import AlertPage, AlertRecord, EvaluationSummary, RuleList
from ..services.alerts import evaluation_summary, get_alert, list_alerts
from ..services.rules import list_rules

router=APIRouter(prefix='/api/v1',tags=['Alertas'])


@router.get('/alerts',response_model=AlertPage,summary='Consultar ocorrências persistidas, com paginação')
def alerts(request: Request,node_id: Identifier | None=None,channel_id: Identifier | None=None,rule_id: Identifier | None=None,status: Literal['active','resolved'] | None=None,limit: int=Query(100,ge=1,le=500),cursor: str | None=Query(None,min_length=1,max_length=2048)) -> dict:
    try:
        return list_alerts(request.app.state.database,{'node_id':node_id,'channel_id':channel_id,'rule_id':rule_id,'status':status},limit,cursor)
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc


@router.get('/alerts/{alert_id}',response_model=AlertRecord,summary='Detalhes da ocorrência e situação das notificações')
def alert(alert_id: Identifier,request: Request) -> dict:
    result=get_alert(request.app.state.database,alert_id)
    if result is None:
        raise HTTPException(status_code=404,detail='Ocorrência não encontrada.')
    return result


@router.get('/alert-rules',response_model=RuleList,summary='Regras cadastradas e estado da avaliação')
def rules(request: Request) -> dict:
    return list_rules(request.app.state.database)


@router.get('/alert-evaluations/summary',response_model=EvaluationSummary,summary='Contagens de avaliação e motivos de não avaliação')
def evaluations(request: Request) -> dict:
    return evaluation_summary(request.app.state.database)
