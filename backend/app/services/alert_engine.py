"""Estado persistido na mesma transação da ingestão; sem chamadas externas."""
import json
from datetime import timedelta
from uuid import uuid4

from ..repositories.recency import select_latest
from ..schemas.alerts import AlertRule
from ..timeutils import iso_utc, now_utc, parse_utc


def audit(connection, reading_id, rule_id, outcome, now):
    connection.execute('INSERT INTO alert_evaluations(reading_id,rule_id,outcome,created_at) VALUES (?,?,?,?)', (reading_id, rule_id, outcome, now))


def enqueue(connection, rule, state, alert_id, event, reading, now):
    created = iso_utc(now)
    due = now
    if state['last_scheduled_at']:
        due = max(due, parse_utc(state['last_scheduled_at']) + timedelta(seconds=rule.cooldown_seconds))
    profile = json.loads(connection.execute('SELECT definition_json FROM profiles WHERE id=? AND version=?', (rule.profile_id, rule.profile_version)).fetchone()[0])
    payload = {'rule_label': rule.label, 'node_id': rule.node_id, 'channel_id': rule.channel_id, 'experimental': rule.experimental, 'source': reading.source, 'value': reading.result.value, 'unit': profile.get('unit',''), 'measured_at': iso_utc(reading.measured_at)}
    connection.execute('''INSERT INTO notification_outbox
        (id,alert_id,event,status,payload_json,created_at,available_at) VALUES (?,?,?,'pending',?,?,?)''', (str(uuid4()), alert_id, event, json.dumps(payload, ensure_ascii=False, allow_nan=False), created, iso_utc(due)))
    state['last_scheduled_at'] = iso_utc(due)


def evaluate_one(connection, rule, state, reading_id, reading, eligible_boot, now):
    stamp = iso_utc(now)
    if reading.profile_id != rule.profile_id or reading.profile_version != rule.profile_version:
        audit(connection, reading_id, rule.id, 'profile_mismatch', stamp)
        return
    if eligible_boot is None or reading.node_boot_id != eligible_boot:
        audit(connection, reading_id, rule.id, 'unconfirmed_session', stamp)
        if eligible_boot is None:
            state.update(breach_count=0,recovery_count=0,last_outcome='unconfirmed_session')
            connection.execute("UPDATE alert_state SET breach_count=0,recovery_count=0,last_outcome='unconfirmed_session' WHERE rule_id=?",(rule.id,))
        return
    same_session = state['node_boot_id'] == reading.node_boot_id
    if same_session and state['last_sequence'] is not None and reading.sequence <= state['last_sequence']:
        audit(connection, reading_id, rule.id, 'delayed', stamp)
        return
    # Histórico conhecido fora da janela não altera o estado atual.
    if reading.measured_at is not None and (now-reading.measured_at).total_seconds() > rule.max_age_seconds:
        audit(connection, reading_id, rule.id, 'delayed', stamp)
        return
    if not same_session:
        state.update(node_boot_id=reading.node_boot_id, last_sequence=None, last_measured_at=None, breach_count=0, recovery_count=0)
    outcome = 'evaluated'
    previous_time = parse_utc(state['last_measured_at']) if state['last_measured_at'] else None
    if reading.quality != 'valid':
        outcome = 'sensor_error'
    elif reading.measured_at is None:
        outcome = 'unknown_time'
    elif reading.measured_at > now:
        outcome = 'future_time'
    elif previous_time and reading.measured_at < previous_time:
        outcome = 'clock_regression'
    elif reading.result.kind != 'numeric':
        outcome = 'non_numeric'
    if outcome != 'evaluated':
        state.update(breach_count=0, recovery_count=0)
    else:
        if previous_time and (reading.measured_at-previous_time).total_seconds() > rule.max_gap_seconds:
            state.update(breach_count=0, recovery_count=0)
        value = reading.result.value
        breach = value < rule.threshold if rule.direction == 'below' else value > rule.threshold
        recovered = value >= rule.recovery_threshold if rule.direction == 'below' else value <= rule.recovery_threshold
        if state['active_alert_id'] is None:
            state['breach_count'] = state['breach_count'] + 1 if breach else 0
            state['recovery_count'] = 0
            if state['breach_count'] >= rule.consecutive:
                identifier = str(uuid4())
                snapshot = rule.model_dump(mode='json')
                connection.execute('''INSERT INTO alerts
                    (id,rule_id,node_id,channel_id,status,opened_reading_id,opened_at,created_at,updated_at,snapshot_json)
                    VALUES (?,?,?,?,'active',?,?,?,?,?)''', (identifier, rule.id, rule.node_id, rule.channel_id, reading_id, iso_utc(reading.measured_at), stamp, stamp, json.dumps(snapshot, ensure_ascii=False)))
                state.update(active_alert_id=identifier, breach_count=0)
                enqueue(connection, rule, state, identifier, 'opened', reading, now)
        else:
            state['recovery_count'] = state['recovery_count'] + 1 if recovered else 0
            state['breach_count'] = 0
            if state['recovery_count'] >= rule.recovery_consecutive:
                identifier = state['active_alert_id']
                connection.execute("UPDATE alerts SET status='resolved',resolved_reading_id=?,resolved_at=?,updated_at=? WHERE id=?", (reading_id, iso_utc(reading.measured_at), stamp, identifier))
                enqueue(connection, rule, state, identifier, 'resolved', reading, now)
                state.update(active_alert_id=None, recovery_count=0)
        state['last_measured_at'] = iso_utc(reading.measured_at)
    state.update(last_sequence=reading.sequence, last_reading_id=reading_id, last_outcome=outcome)
    audit(connection, reading_id, rule.id, outcome, stamp)
    connection.execute('''UPDATE alert_state SET node_boot_id=?,last_sequence=?,last_reading_id=?,last_measured_at=?,
        breach_count=?,recovery_count=?,active_alert_id=?,last_outcome=?,last_scheduled_at=? WHERE rule_id=?''', tuple(state[k] for k in ('node_boot_id','last_sequence','last_reading_id','last_measured_at','breach_count','recovery_count','active_alert_id','last_outcome','last_scheduled_at'))+(rule.id,))


def evaluate_new_readings(connection, records):
    now = now_utc()
    grouped = {}
    for reading_id, reading in records:
        grouped.setdefault((reading.node_id, reading.channel_id, reading.source), []).append((reading_id, reading))
    for (node_id, channel_id, source), entries in grouped.items():
        node = connection.execute('SELECT current_boot_id FROM nodes WHERE id=?',(node_id,)).fetchone()
        candidate, _ = select_latest(connection, node_id, channel_id, node['current_boot_id'])
        eligible_boot = candidate['node_boot_id'] if candidate else None
        rows = connection.execute('SELECT definition_json FROM alert_rules WHERE enabled=1 AND node_id=? AND channel_id=? AND source=? ORDER BY id', (node_id, channel_id, source)).fetchall()
        for row in rows:
            rule = AlertRule.model_validate_json(row['definition_json'])
            state = dict(connection.execute('SELECT * FROM alert_state WHERE rule_id=?',(rule.id,)).fetchone())
            # Só uma sessão é elegível. Dentro dela, sequência é a ordem de aquisição.
            for reading_id, reading in sorted(entries, key=lambda pair: pair[1].sequence):
                evaluate_one(connection, rule, state, reading_id, reading, eligible_boot, now)
