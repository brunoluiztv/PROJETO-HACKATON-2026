import base64
import hashlib
import json

from ..database import Database
from ..schemas.queries import PageCursor
from .history import decode_page_cursor, public_reading


def public_alert(connection, row):
    snapshot = json.loads(row['snapshot_json'])
    opening = connection.execute('SELECT * FROM readings WHERE id=?',(row['opened_reading_id'],)).fetchone()
    closing = connection.execute('SELECT * FROM readings WHERE id=?',(row['resolved_reading_id'],)).fetchone() if row['resolved_reading_id'] else None
    delivery = connection.execute('SELECT event,status,attempts,available_at,settled_at FROM notification_outbox WHERE alert_id=? ORDER BY created_at,rowid',(row['id'],)).fetchall()
    enabled = connection.execute('SELECT enabled FROM alert_rules WHERE id=?',(row['rule_id'],)).fetchone()[0]
    return {key:row[key] for key in ('id','rule_id','node_id','channel_id','status','opened_at','resolved_at','created_at','updated_at')} | {'rule':snapshot,'rule_enabled':bool(enabled),'opening_reading':public_reading(opening),'recovery_reading':public_reading(closing) if closing else None,'notifications':[dict(item) for item in delivery]}


def get_alert(database: Database, identifier: str):
    with database.connection(readonly=True) as connection:
        connection.execute('BEGIN')
        row = connection.execute('SELECT * FROM alerts WHERE id=?',(identifier,)).fetchone()
        return public_alert(connection,row) if row else None


def list_alerts(database: Database, filters: dict, limit: int, cursor: str | None) -> dict:
    digest = hashlib.sha256(json.dumps({'scope':'alerts',**filters},sort_keys=True).encode()).hexdigest()
    position = decode_page_cursor(cursor,digest) if cursor else None
    with database.connection(readonly=True) as connection:
        connection.execute('BEGIN')
        snapshot = position.snapshot if position else connection.execute('SELECT COALESCE(MAX(rowid),0) FROM alerts').fetchone()[0]
        conditions = ['rowid<=?']
        args = [snapshot]
        for key,value in filters.items():
            if value is not None:
                conditions.append(f'{key}=?');args.append(value)
        if position:
            conditions.append('(substr(created_at,1,26),id)<(?,?)');args.extend([position.key,position.id])
        args.append(limit+1)
        rows = connection.execute(f"SELECT * FROM alerts WHERE {' AND '.join(conditions)} ORDER BY created_at DESC,id DESC LIMIT ?",args).fetchall()
        page = rows[:limit]
        next_cursor = None
        if len(rows)>limit:
            row = page[-1]
            position = PageCursor(snapshot=snapshot,key=row['created_at'][:26],id=row['id'],filters=digest)
            next_cursor = base64.urlsafe_b64encode(position.model_dump_json().encode()).decode().rstrip('=')
        return {'items':[public_alert(connection,row) for row in page],'next_cursor':next_cursor}


def evaluation_summary(database: Database) -> dict:
    with database.connection(readonly=True) as connection:
        rows=connection.execute('SELECT outcome,COUNT(*) AS count FROM alert_evaluations GROUP BY outcome ORDER BY outcome').fetchall()
        return {'items':[dict(row) for row in rows]}
