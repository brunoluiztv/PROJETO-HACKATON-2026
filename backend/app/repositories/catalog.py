import json
import sqlite3


def find_channel(connection: sqlite3.Connection, node_id: str, channel_id: str):
    return connection.execute("""SELECT n.gateway_id, c.sensor_id, c.profile_id, c.profile_version,
        p.kind, p.definition_json FROM channels c
        JOIN nodes n ON n.id=c.node_id
        JOIN profiles p ON p.id=c.profile_id AND p.version=c.profile_version
        WHERE c.node_id=? AND c.id=?""", (node_id, channel_id)).fetchone()


def list_profiles(connection: sqlite3.Connection) -> list[dict]:
    return [json.loads(row["definition_json"]) for row in connection.execute("SELECT definition_json FROM profiles ORDER BY id, version")]
