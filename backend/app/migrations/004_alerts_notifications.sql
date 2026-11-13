CREATE TABLE alert_rules (
    id TEXT PRIMARY KEY NOT NULL,
    node_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    profile_version INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('simulation', 'physical_sensor')),
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    definition_json TEXT NOT NULL CHECK (json_valid(definition_json)),
    created_at TEXT NOT NULL,
    FOREIGN KEY (node_id, channel_id) REFERENCES channels(node_id, id),
    FOREIGN KEY (profile_id, profile_version) REFERENCES profiles(id, version)
);
CREATE INDEX idx_alert_rules_channel ON alert_rules(node_id, channel_id, source, enabled);
CREATE TABLE alerts (
    id TEXT PRIMARY KEY NOT NULL,
    rule_id TEXT NOT NULL REFERENCES alert_rules(id),
    node_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'resolved')),
    opened_reading_id TEXT NOT NULL REFERENCES readings(id),
    resolved_reading_id TEXT REFERENCES readings(id),
    opened_at TEXT NOT NULL,
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
    FOREIGN KEY (node_id, channel_id) REFERENCES channels(node_id, id)
);
CREATE UNIQUE INDEX idx_one_active_alert ON alerts(rule_id) WHERE status='active';
CREATE INDEX idx_alerts_page ON alerts(created_at, id);
CREATE TABLE alert_state (
    rule_id TEXT PRIMARY KEY NOT NULL REFERENCES alert_rules(id),
    node_boot_id TEXT,
    last_sequence INTEGER,
    last_reading_id TEXT REFERENCES readings(id),
    last_measured_at TEXT,
    breach_count INTEGER NOT NULL DEFAULT 0,
    recovery_count INTEGER NOT NULL DEFAULT 0,
    active_alert_id TEXT REFERENCES alerts(id),
    last_outcome TEXT NOT NULL DEFAULT 'no_data',
    last_scheduled_at TEXT
);
CREATE TABLE alert_evaluations (
    reading_id TEXT NOT NULL REFERENCES readings(id),
    rule_id TEXT NOT NULL REFERENCES alert_rules(id),
    outcome TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (reading_id, rule_id)
);
CREATE TABLE notification_outbox (
    id TEXT PRIMARY KEY NOT NULL,
    alert_id TEXT NOT NULL REFERENCES alerts(id),
    event TEXT NOT NULL CHECK (event IN ('opened', 'resolved')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'leased', 'sent', 'dead')),
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    chat_id TEXT,
    created_at TEXT NOT NULL,
    available_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    leased_by TEXT,
    lease_token_hash TEXT,
    lease_expires_at TEXT,
    telegram_message_id INTEGER,
    last_error TEXT,
    settled_action TEXT CHECK (settled_action IN ('delivered', 'failed')),
    settled_at TEXT,
    UNIQUE (alert_id, event)
);
CREATE INDEX idx_outbox_due ON notification_outbox(status, available_at, id);
CREATE TABLE service_credentials (
    name TEXT PRIMARY KEY NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);
