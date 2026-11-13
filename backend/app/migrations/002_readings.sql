ALTER TABLE gateways ADD COLUMN token_hash TEXT;
CREATE UNIQUE INDEX idx_gateways_token ON gateways(token_hash) WHERE token_hash IS NOT NULL;
CREATE TABLE readings (
    id TEXT PRIMARY KEY NOT NULL,
    gateway_id TEXT NOT NULL REFERENCES gateways(id),
    node_id TEXT NOT NULL,
    node_boot_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    channel_id TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    profile_version INTEGER NOT NULL,
    result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
    quality TEXT NOT NULL CHECK (quality IN ('valid', 'sensor_error')),
    source TEXT NOT NULL CHECK (source IN ('simulation', 'physical_sensor')),
    measured_at TEXT,
    time_quality TEXT NOT NULL CHECK (time_quality IN ('synchronized', 'unknown')),
    node_uptime_ms INTEGER NOT NULL CHECK (node_uptime_ms >= 0),
    received_at TEXT NOT NULL,
    acquisition_json TEXT NOT NULL CHECK (json_valid(acquisition_json)),
    UNIQUE (node_id, node_boot_id, sequence, channel_id),
    FOREIGN KEY (node_id, channel_id) REFERENCES channels(node_id, id),
    FOREIGN KEY (profile_id, profile_version) REFERENCES profiles(id, version),
    CHECK ((quality = 'valid' AND result_json IS NOT NULL) OR (quality = 'sensor_error' AND result_json IS NULL)),
    CHECK ((time_quality = 'unknown' AND measured_at IS NULL) OR (time_quality = 'synchronized' AND measured_at IS NOT NULL))
);
CREATE INDEX idx_readings_history ON readings(node_id, channel_id, measured_at, id);
CREATE INDEX idx_readings_session ON readings(node_id, node_boot_id, channel_id, sequence);
