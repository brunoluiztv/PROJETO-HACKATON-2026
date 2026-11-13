"""Outbox persistente: reserva atômica, confirmação idempotente e retry limitado."""
import hmac
import json
import secrets
from datetime import timedelta

from ..database import Database
from ..security import token_hash
from ..timeutils import iso_utc, now_utc, parse_utc


class NotificationMissing(ValueError):
    pass


class LeaseConflict(ValueError):
    pass


class BotNotConfigured(ValueError):
    pass


def retry_delay(attempt, settings):
    return min(settings.notification_retry_seconds * 2 ** max(0, attempt-1), 3600)


def notification_text(row, alert_status, dashboard_url, now):
    payload = json.loads(row['payload_json'])
    title = 'ALERTA EXPERIMENTAL' if payload['experimental'] else 'ALERTA DE MONITORAMENTO'
    event = 'Abertura de ocorrência' if row['event']=='opened' else 'Recuperação registrada'
    late = (now-parse_utc(row['created_at'])).total_seconds() >= 60
    lines = [title, event + (' — aviso com atraso' if late else ''), payload['rule_label'],
             f"Nó: {payload['node_id']} · canal: {payload['channel_id']}",
             f"Valor do evento: {payload['value']} {payload['unit']}",
             f"Coleta (UTC): {payload['measured_at']}",
             f"Situação conhecida da ocorrência: {'ativa' if alert_status=='active' else 'resolvida'}",
             f"Origem: {'simulação' if payload['source']=='simulation' else 'sensor físico'}",
             f"Ocorrência: {row['alert_id']}", 'Consulte o painel para a leitura mais recente.']
    if dashboard_url:
        lines.append(f'Painel: {dashboard_url}')
    else:
        lines.append('Link do painel não configurado.')
    return '\n'.join(lines)


def claim(database: Database, settings, body) -> dict:
    if settings.authorized_telegram_chat_id is None:
        raise BotNotConfigured('Configure AUTHORIZED_TELEGRAM_CHAT_ID antes de reservar notificações.')
    now = now_utc()
    stamp = iso_utc(now)
    expires = iso_utc(now+timedelta(seconds=settings.notification_lease_seconds))
    items = []
    with database.transaction() as connection:
        expired = connection.execute("SELECT * FROM notification_outbox WHERE status='leased' AND lease_expires_at<=?",(stamp,)).fetchall()
        for row in expired:
            status = 'dead' if row['attempts']>=settings.notification_max_attempts else 'pending'
            available = iso_utc(now+timedelta(seconds=retry_delay(row['attempts'],settings)))
            connection.execute("UPDATE notification_outbox SET status=?,available_at=?,last_error='lease_expired',settled_action=NULL WHERE id=?",(status,available,row['id']))
        connection.execute("UPDATE notification_outbox SET status='dead',last_error='destination_changed',settled_action=NULL WHERE status='pending' AND chat_id IS NOT NULL AND chat_id<>?",(settings.authorized_telegram_chat_id,))
        connection.execute("UPDATE notification_outbox SET status='dead',last_error='attempt_limit',settled_action=NULL WHERE status='pending' AND attempts>=?",(settings.notification_max_attempts,))
        rows = connection.execute("SELECT * FROM notification_outbox WHERE status='pending' AND available_at<=? ORDER BY available_at,rowid LIMIT ?",(stamp,body.limit)).fetchall()
        for row in rows:
            lease_token = secrets.token_urlsafe(32)
            connection.execute("""UPDATE notification_outbox SET status='leased',attempts=attempts+1,
                leased_by=?,lease_token_hash=?,lease_expires_at=?,chat_id=?,settled_action=NULL WHERE id=?""",(body.worker_id,token_hash(lease_token),expires,settings.authorized_telegram_chat_id,row['id']))
            alert_status = connection.execute('SELECT status FROM alerts WHERE id=?',(row['alert_id'],)).fetchone()[0]
            items.append({'id':row['id'],'alert_id':row['alert_id'],'event':row['event'],'chat_id':settings.authorized_telegram_chat_id,'text':notification_text(row,alert_status,settings.dashboard_url,now),'lease_token':lease_token,'lease_expires_at':expires,'attempt':row['attempts']+1})
    return {'items':items}


def settle(database: Database, settings, identifier, body, action):
    now = now_utc()
    stamp = iso_utc(now)
    with database.transaction() as connection:
        row = connection.execute('SELECT * FROM notification_outbox WHERE id=?',(identifier,)).fetchone()
        if row is None:
            raise NotificationMissing('Notificação não encontrada.')
        if row['leased_by']!=body.worker_id or not row['lease_token_hash'] or not hmac.compare_digest(row['lease_token_hash'],token_hash(body.lease_token)):
            raise LeaseConflict('Reserva não pertence ao worker/token informado.')
        matching = row['settled_action']==action and ((action=='delivered' and row['telegram_message_id']==body.telegram_message_id) or (action=='failed' and row['last_error']==body.error))
        if matching:
            return {'id':identifier,'status':row['status'],'duplicate':True,'available_at':row['available_at']}
        if row['status']!='leased' or row['settled_action'] or not row['lease_expires_at'] or parse_utc(row['lease_expires_at'])<=now:
            raise LeaseConflict('Reserva expirada ou já finalizada com outro resultado.')
        if action=='delivered':
            connection.execute("UPDATE notification_outbox SET status='sent',telegram_message_id=?,last_error=NULL,settled_action='delivered',settled_at=? WHERE id=?",(body.telegram_message_id,stamp,identifier))
            status = 'sent'
            available = row['available_at']
        else:
            status = 'dead' if row['attempts']>=settings.notification_max_attempts else 'pending'
            available = iso_utc(now+timedelta(seconds=retry_delay(row['attempts'],settings)))
            connection.execute("UPDATE notification_outbox SET status=?,available_at=?,last_error=?,settled_action='failed',settled_at=? WHERE id=?",(status,available,body.error,stamp,identifier))
    return {'id':identifier,'status':status,'duplicate':False,'available_at':available}


def list_notifications(database: Database, state: str | None, limit: int) -> dict:
    where = 'WHERE status=?' if state else ''
    args = (state,limit) if state else (limit,)
    with database.connection(readonly=True) as connection:
        rows = connection.execute(f'''SELECT id,alert_id,event,status,chat_id,created_at,available_at,
            attempts,leased_by,lease_expires_at,telegram_message_id,last_error,settled_at
            FROM notification_outbox {where} ORDER BY created_at DESC,rowid DESC LIMIT ?''',args).fetchall()
        return {'items':[dict(row) for row in rows]}


def requeue(database: Database, identifier: str) -> dict:
    """Ação local explícita do operador, somente para mensagens encerradas sem sucesso."""
    with database.transaction() as connection:
        row=connection.execute('SELECT status FROM notification_outbox WHERE id=?',(identifier,)).fetchone()
        if row is None or row['status']!='dead':
            raise ValueError('Somente notificações em dead podem ser recolocadas na fila.')
        connection.execute("""UPDATE notification_outbox SET status='pending',attempts=0,available_at=?,
            chat_id=NULL,leased_by=NULL,lease_token_hash=NULL,lease_expires_at=NULL,
            settled_action=NULL,settled_at=NULL,last_error='manually_requeued' WHERE id=?""",(iso_utc(now_utc()),identifier))
    return {'id':identifier,'status':'pending','note':'Novo ciclo de tentativas; o próximo claim usa o chat autorizado atual.'}
