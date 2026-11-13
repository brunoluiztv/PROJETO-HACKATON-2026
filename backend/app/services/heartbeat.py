"""Relatórios atuais, ordenados por inicialização persistida e sequência."""
import hashlib
import json
from datetime import timedelta

from ..database import Database
from ..schemas.heartbeat import Heartbeat
from ..timeutils import iso_utc, now_utc, parse_utc


class SessionConflict(ValueError):
    pass


class UnauthorizedNode(ValueError):
    pass


def validate_session(connection, table, owner_column, owner_id, count, boot_id):
    rows = connection.execute(f"SELECT boot_count, boot_id FROM {table} WHERE {owner_column}=? AND (boot_count=? OR boot_id=?)", (owner_id, count, boot_id)).fetchall()
    if any(row["boot_count"] != count or row["boot_id"] != boot_id for row in rows):
        raise SessionConflict("Contador de inicialização e boot_id já foram associados a outra sessão.")


def save_session(connection, table, owner_column, owner_id, count, boot_id):
    connection.execute(f"INSERT INTO {table} ({owner_column}, boot_count, boot_id) VALUES (?, ?, ?) ON CONFLICT({owner_column}, boot_count) DO NOTHING", (owner_id, count, boot_id))


def receive_heartbeat(database: Database, gateway_id: str, heartbeat: Heartbeat) -> dict:
    payload = heartbeat.model_dump(mode="json")
    payload["nodes"].sort(key=lambda node: node["node_id"])
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    with database.transaction() as connection:
        now = now_utc()
        received_at = iso_utc(now)
        gateway = connection.execute("SELECT * FROM gateways WHERE id=?", (gateway_id,)).fetchone()
        if gateway is None:
            raise UnauthorizedNode("Gateway não cadastrado.")
        nodes = {}
        for observation in heartbeat.nodes:
            node = connection.execute("SELECT * FROM nodes WHERE id=? AND gateway_id=?", (observation.node_id, gateway_id)).fetchone()
            if node is None:
                raise UnauthorizedNode("O relatório contém um nó não autorizado para este gateway.")
            nodes[observation.node_id] = node
        validate_session(connection, "gateway_sessions", "gateway_id", gateway_id, heartbeat.gateway_boot_count, heartbeat.gateway_boot_id)
        previous_count = gateway["heartbeat_boot_count"]
        status = "accepted"
        if previous_count is not None:
            if heartbeat.gateway_boot_count < previous_count or (heartbeat.gateway_boot_count == previous_count and heartbeat.sequence < gateway["heartbeat_sequence"]):
                status = "ignored"
            elif heartbeat.gateway_boot_count == previous_count and heartbeat.sequence == gateway["heartbeat_sequence"]:
                if digest != gateway["heartbeat_payload_hash"]:
                    raise SessionConflict("Mesma identidade de heartbeat com conteúdo diferente.")
                status = "duplicate"
        # Mesmo um reenvio prova uma requisição autenticada agora, mas não novo contato de rádio.
        last_seen = gateway["last_seen_at"]
        if last_seen is None or parse_utc(last_seen) < now:
            connection.execute("UPDATE gateways SET last_seen_at=? WHERE id=?", (received_at, gateway_id))
        results = []
        if status == "accepted":
            save_session(connection, "gateway_sessions", "gateway_id", gateway_id, heartbeat.gateway_boot_count, heartbeat.gateway_boot_id)
            for observation in heartbeat.nodes:
                node = nodes[observation.node_id]
                validate_session(connection, "node_sessions", "node_id", observation.node_id, observation.node_boot_count, observation.node_boot_id)
                if node["current_boot_count"] is not None and observation.node_boot_count < node["current_boot_count"]:
                    results.append({"node_id": observation.node_id, "status": "ignored", "reason": "older_node_boot"})
                    continue
                save_session(connection, "node_sessions", "node_id", observation.node_id, observation.node_boot_count, observation.node_boot_id)
                radio_time = now - timedelta(milliseconds=observation.last_radio_age_ms) if observation.last_radio_age_ms is not None else None
                if node["current_boot_id"] == observation.node_boot_id and node["last_radio_seen_at"]:
                    previous_radio = parse_utc(node["last_radio_seen_at"])
                    radio_time = max(previous_radio, radio_time) if radio_time else previous_radio
                connection.execute("""UPDATE nodes SET current_boot_id=?, current_boot_count=?, session_reported_at=?, last_radio_seen_at=? WHERE id=?""", (observation.node_boot_id, observation.node_boot_count, received_at, iso_utc(radio_time) if radio_time else None, observation.node_id))
                results.append({"node_id": observation.node_id, "status": "accepted"})
            connection.execute("""UPDATE gateways SET heartbeat_boot_id=?, heartbeat_boot_count=?, heartbeat_sequence=?, heartbeat_payload_hash=?, last_heartbeat_at=? WHERE id=?""", (heartbeat.gateway_boot_id, heartbeat.gateway_boot_count, heartbeat.sequence, digest, received_at, gateway_id))
        confirmed_at = received_at if status == "accepted" else gateway["last_heartbeat_at"]
    return {"gateway_id": gateway_id, "status": status, "last_heartbeat_at": confirmed_at, "nodes": results}
