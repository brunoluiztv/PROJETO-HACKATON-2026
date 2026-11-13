"""Histórico paginado por chave e snapshot; o cursor não é uma credencial."""
import base64
import binascii
import hashlib
import json

from pydantic import ValidationError

from ..database import Database
from ..repositories.readings import SORT_KEY
from ..schemas.queries import HistoryFilters, PageCursor
from ..timeutils import iso_utc



def public_reading(row) -> dict:
    return {**json.loads(row["acquisition_json"]), "id": row["id"], "gateway_id": row["gateway_id"], "received_at": row["received_at"]}


def fingerprint(filters: HistoryFilters) -> str:
    return hashlib.sha256(json.dumps(filters.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()


def decode_cursor(value: str, filters: HistoryFilters) -> PageCursor:
    return decode_page_cursor(value, fingerprint(filters))


def decode_page_cursor(value: str, expected_fingerprint: str) -> PageCursor:
    try:
        decoded = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
        cursor = PageCursor.model_validate_json(decoded)
        if cursor.filters != expected_fingerprint:
            raise ValueError("Filtros diferentes dos usados para criar o cursor.")
        return cursor
    except (ValueError, binascii.Error, ValidationError) as exc:
        raise ValueError("Cursor inválido ou incompatível com os filtros.") from exc


def list_readings(database: Database, filters: HistoryFilters, limit: int, cursor: str | None) -> dict:
    position = decode_cursor(cursor, filters) if cursor else None
    conditions = ["r.rowid <= ?"]
    with database.connection(readonly=True) as connection:
        snapshot = position.snapshot if position else connection.execute("SELECT COALESCE(MAX(rowid),0) FROM readings").fetchone()[0]
        args = [snapshot]
        for field in ("node_id", "channel_id", "time_quality", "source"):
            value = getattr(filters, field)
            if value is not None:
                conditions.append(f"r.{field} = ?")
                args.append(value)
        if filters.from_at:
            conditions.append(f"({SORT_KEY}) >= ?")
            args.append(iso_utc(filters.from_at)[:-1])
        if filters.to_at:
            conditions.append(f"({SORT_KEY}) <= ? AND r.measured_at IS NOT NULL")
            args.append(iso_utc(filters.to_at)[:-1])
        where = " AND ".join(conditions)
        after = ""
        if position:
            after = "WHERE (sort_key, id) < (?, ?)"
            args.extend([position.key, position.id])
        args.append(limit + 1)
        rows = connection.execute(f"""WITH history AS (
            SELECT r.*, {SORT_KEY} AS sort_key FROM readings r WHERE {where}
        ) SELECT * FROM history {after} ORDER BY sort_key DESC, id DESC LIMIT ?""", args).fetchall()
    page = rows[:limit]
    next_cursor = None
    if len(rows) > limit:
        last = page[-1]
        next_position = PageCursor(snapshot=snapshot, key=last["sort_key"], id=last["id"], filters=fingerprint(filters))
        next_cursor = base64.urlsafe_b64encode(next_position.model_dump_json().encode()).decode().rstrip("=")
    return {"items": [public_reading(row) for row in page], "next_cursor": next_cursor}
