"""Prontidão do SQLite, sem criar nem reparar o banco durante uma consulta."""

import logging
import sqlite3

from ..database import Database, migrations

logger = logging.getLogger(__name__)


def check_health(database: Database) -> tuple[dict, int]:
    try:
        expected = migrations()
        with database.connection(readonly=True) as connection:
            connection.execute("SELECT 1").fetchone()
            applied = connection.execute("SELECT version, name, checksum FROM schema_migrations ORDER BY version").fetchall()
            if [(r["version"], r["name"], r["checksum"]) for r in applied] != [(m.version, m.name, m.checksum) for m in expected]:
                raise RuntimeError("Versão do banco incompatível.")
            for name in ("gateways", "nodes", "profiles", "channels", "readings", "gateway_sessions", "node_sessions", "alert_rules", "alert_state", "alerts", "alert_evaluations", "notification_outbox", "service_credentials"):
                connection.execute(f"SELECT 1 FROM {name} LIMIT 1").fetchone()
        return {"status": "ok", "database": "ok", "schema_version": expected[-1].version}, 200
    except (sqlite3.Error, OSError, RuntimeError):
        logger.exception("Falha ao verificar prontidão do banco.")
        return {"status": "unavailable", "database": "unavailable", "schema_version": None}, 503
