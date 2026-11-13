"""Cadastro demonstrativo explícito, repetível e sem leituras ou credenciais."""

import json
from pathlib import Path

from .database import Database, utc_now


def seed_demo(database: Database) -> dict[str, int]:
    profiles = json.loads((Path(__file__).parent / "demo_catalog.json").read_text(encoding="utf-8"))
    channel_ids = {"signal-demo": "signal-01", "temperature-demo": "temperature-01", "class-demo": "class-01", "event-demo": "event-01"}
    now = utc_now()
    with database.transaction() as connection:
        connection.execute("INSERT INTO gateways (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING", ("gateway-demo-01", "Gateway demonstrativo", now))
        for profile in profiles:
            connection.execute("INSERT INTO profiles (id, version, kind, definition_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id, version) DO NOTHING", (profile["id"], profile["version"], profile["kind"], json.dumps(profile, ensure_ascii=False, sort_keys=True), now))
        for number in (1, 2):
            node_id = f"node-demo-{number:02d}"
            connection.execute("INSERT INTO nodes (id, gateway_id, name, area_id, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING", (node_id, "gateway-demo-01", f"Ponto demonstrativo {number:02d}", "area-demo", now))
            for profile in profiles:
                channel_id = channel_ids[profile["id"]]
                connection.execute("INSERT INTO channels (node_id, id, sensor_id, name, profile_id, profile_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(node_id, id) DO NOTHING", (node_id, channel_id, "sensor-demo-01", profile["label"], profile["id"], profile["version"], now))
        counts = {name: connection.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] for name in ("gateways", "nodes", "profiles", "channels")}
    return counts
