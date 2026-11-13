CREATE TABLE gateways (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT
);
CREATE TABLE nodes (
    id TEXT PRIMARY KEY NOT NULL,
    gateway_id TEXT NOT NULL REFERENCES gateways(id),
    name TEXT NOT NULL,
    area_id TEXT NOT NULL,
    current_boot_id TEXT,
    last_radio_seen_at TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_nodes_gateway ON nodes(gateway_id);
CREATE TABLE profiles (
    id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    kind TEXT NOT NULL CHECK (kind IN ('numeric', 'categorical', 'boolean')),
    definition_json TEXT NOT NULL CHECK (json_valid(definition_json)),
    created_at TEXT NOT NULL,
    PRIMARY KEY (id, version)
);
CREATE TABLE channels (
    node_id TEXT NOT NULL REFERENCES nodes(id),
    id TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    name TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    profile_version INTEGER NOT NULL,
    calibration_id TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (node_id, id),
    FOREIGN KEY (profile_id, profile_version) REFERENCES profiles(id, version)
);
CREATE INDEX idx_channels_profile ON channels(profile_id, profile_version);
