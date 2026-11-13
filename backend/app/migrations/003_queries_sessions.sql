ALTER TABLE gateways ADD COLUMN heartbeat_boot_id TEXT;
ALTER TABLE gateways ADD COLUMN heartbeat_boot_count INTEGER;
ALTER TABLE gateways ADD COLUMN heartbeat_sequence INTEGER;
ALTER TABLE gateways ADD COLUMN heartbeat_payload_hash TEXT;
ALTER TABLE gateways ADD COLUMN last_heartbeat_at TEXT;
ALTER TABLE nodes ADD COLUMN current_boot_count INTEGER;
ALTER TABLE nodes ADD COLUMN session_reported_at TEXT;
ALTER TABLE channels ADD COLUMN stale_after_seconds INTEGER CHECK (stale_after_seconds > 0);
CREATE TABLE gateway_sessions (
    gateway_id TEXT NOT NULL REFERENCES gateways(id),
    boot_count INTEGER NOT NULL CHECK (boot_count >= 0),
    boot_id TEXT NOT NULL,
    PRIMARY KEY (gateway_id, boot_count),
    UNIQUE (gateway_id, boot_id)
);
CREATE TABLE node_sessions (
    node_id TEXT NOT NULL REFERENCES nodes(id),
    boot_count INTEGER NOT NULL CHECK (boot_count >= 0),
    boot_id TEXT NOT NULL,
    PRIMARY KEY (node_id, boot_count),
    UNIQUE (node_id, boot_id)
);
CREATE INDEX idx_readings_page ON readings (
    COALESCE(substr(replace(measured_at, 'Z', '') || CASE WHEN instr(measured_at, '.') = 0 THEN '.000000' ELSE '000000' END, 1, 26), ''),
    id
);
