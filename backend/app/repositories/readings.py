import json
import sqlite3
from uuid import uuid4

from ..schemas.readings import Reading

# O Pydantic armazena UTC com fração opcional: completar microssegundos evita
# ordenar "00Z" depois de "00.500Z" dentro do mesmo segundo.
SORT_KEY = "COALESCE(substr(replace(measured_at, 'Z', '') || CASE WHEN instr(measured_at, '.') = 0 THEN '.000000' ELSE '000000' END, 1, 26), '')"



def acquisition_json(reading: Reading) -> str:
    return json.dumps(reading.model_dump(mode="json"), sort_keys=True, separators=(",", ":"), allow_nan=False)


def find_reading(connection: sqlite3.Connection, reading: Reading):
    return connection.execute("SELECT id, acquisition_json FROM readings WHERE node_id=? AND node_boot_id=? AND sequence=? AND channel_id=?", (reading.node_id, reading.node_boot_id, reading.sequence, reading.channel_id)).fetchone()


def insert_reading(connection: sqlite3.Connection, gateway_id: str, reading: Reading, canonical: str, received_at: str) -> str:
    identifier = str(uuid4())
    data = reading.model_dump(mode="json")
    connection.execute("""INSERT INTO readings (
        id, gateway_id, node_id, node_boot_id, sequence, channel_id, sensor_id,
        profile_id, profile_version, result_json, quality, source, measured_at,
        time_quality, node_uptime_ms, received_at, acquisition_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
        identifier, gateway_id, reading.node_id, reading.node_boot_id, reading.sequence,
        reading.channel_id, reading.sensor_id, reading.profile_id, reading.profile_version,
        json.dumps(data["result"], allow_nan=False) if reading.result is not None else None,
        reading.quality, reading.source, data["measured_at"], reading.time_quality,
        reading.node_uptime_ms, received_at, canonical,
    ))
    return identifier
