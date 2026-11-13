from ..database import Database
from ..timeutils import now_utc
from .history import public_reading
from ..repositories.recency import select_latest
from .recency import freshness


def contact_status(observed_at, reported_at, stale_after, *, now, no_data=False):
    state = freshness(observed_at, reported_at, stale_after, now=now, no_data=no_data)
    state["observed_at"] = state.pop("measured_at")
    state["reported_at"] = state.pop("received_at")
    return state


def public_channel(row, default_stale: int) -> dict:
    return {"channel_id": row["id"], "sensor_id": row["sensor_id"], "name": row["name"], "profile_id": row["profile_id"], "profile_version": row["profile_version"], "calibration_id": row["calibration_id"], "stale_after_seconds": row["stale_after_seconds"] or default_stale}


def list_devices(database: Database, default_stale: int) -> dict:
    now = now_utc()
    with database.connection(readonly=True) as connection:
        connection.execute("BEGIN")
        items = []
        for row in connection.execute("SELECT * FROM gateways ORDER BY id"):
            items.append({"id": row["id"], "role": "gateway", "name": row["name"], "last_seen_at": row["last_seen_at"], "communication": contact_status(row["last_seen_at"], row["last_seen_at"], default_stale, now=now, no_data=row["last_seen_at"] is None), "heartbeat": {"boot_id": row["heartbeat_boot_id"], "boot_count": row["heartbeat_boot_count"], "sequence": row["heartbeat_sequence"], "received_at": row["last_heartbeat_at"]}})
        for row in connection.execute("SELECT * FROM nodes ORDER BY id"):
            channels = [public_channel(c, default_stale) for c in connection.execute("SELECT * FROM channels WHERE node_id=? ORDER BY id", (row["id"],))]
            items.append({"id": row["id"], "role": "node", "name": row["name"], "gateway_id": row["gateway_id"], "area_id": row["area_id"], "current_boot_id": row["current_boot_id"], "current_boot_count": row["current_boot_count"], "session_reported_at": row["session_reported_at"], "last_radio_seen_at": row["last_radio_seen_at"], "radio_contact": {**contact_status(row["last_radio_seen_at"], row["session_reported_at"], default_stale, now=now), "time_quality": "estimated" if row["last_radio_seen_at"] else "unknown"}, "channels": channels})
    return {"items": items}


def latest_readings(database: Database, node_id: str, default_stale: int) -> dict | None:
    now = now_utc()
    with database.connection(readonly=True) as connection:
        connection.execute("BEGIN")
        node = connection.execute("SELECT * FROM nodes WHERE id=?", (node_id,)).fetchone()
        if node is None:
            return None
        channels = []
        for channel in connection.execute("SELECT * FROM channels WHERE node_id=? ORDER BY id", (node_id,)):
            row, selection = select_latest(connection, node_id, channel["id"], node["current_boot_id"])
            stale_after = channel["stale_after_seconds"] or default_stale
            reason = "ambiguous_sessions" if selection == "ambiguous_sessions" else "no_reading_in_reported_session" if row is None and selection == "reported_session" else None
            state = freshness(row["measured_at"] if row else None, row["received_at"] if row else None, stale_after, now=now, no_data=row is None and selection != "ambiguous_sessions", reason=reason)
            channels.append({**public_channel(channel, default_stale), "selection": selection, "reading": public_reading(row) if row else None, "freshness": state})
    return {"node_id": node_id, "gateway_id": node["gateway_id"], "current_boot_id": node["current_boot_id"], "channels": channels}
