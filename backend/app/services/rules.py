import json

from ..database import Database, utc_now
from ..repositories.catalog import find_channel
from ..schemas.alerts import AlertRule


def add_rule(database: Database, rule: AlertRule) -> dict:
    rule = AlertRule.model_validate(rule.model_dump())
    definition = rule.model_dump(mode='json')
    encoded = json.dumps(definition, sort_keys=True)
    with database.transaction() as connection:
        channel = find_channel(connection, rule.node_id, rule.channel_id)
        if channel is None or channel['kind'] != 'numeric' or (channel['profile_id'], channel['profile_version']) != (rule.profile_id, rule.profile_version):
            raise ValueError('Regra exige um canal numérico com o perfil cadastrado correspondente.')
        existing = connection.execute('SELECT definition_json, enabled FROM alert_rules WHERE id=?', (rule.id,)).fetchone()
        if existing:
            if existing['definition_json'] != encoded:
                raise ValueError('ID da regra já existe com outra configuração. Use novo ID para preservar o histórico.')
            return {'id': rule.id, 'created': False, 'enabled': bool(existing['enabled'])}
        connection.execute('''INSERT INTO alert_rules
            (id,node_id,channel_id,profile_id,profile_version,source,enabled,definition_json,created_at)
            VALUES (?,?,?,?,?,?,?,?,?)''', (rule.id, rule.node_id, rule.channel_id, rule.profile_id, rule.profile_version, rule.source, int(rule.enabled), encoded, utc_now()))
        connection.execute('INSERT INTO alert_state(rule_id) VALUES (?)', (rule.id,))
    return {'id': rule.id, 'created': True, 'enabled': rule.enabled}


def disable_rule(database: Database, identifier: str) -> dict:
    with database.transaction() as connection:
        if connection.execute('UPDATE alert_rules SET enabled=0 WHERE id=?', (identifier,)).rowcount != 1:
            raise ValueError('Regra não encontrada.')
        connection.execute('UPDATE alert_state SET breach_count=0,recovery_count=0 WHERE rule_id=?', (identifier,))
    return {'id': identifier, 'enabled': False}


def list_rules(database: Database) -> dict:
    with database.connection(readonly=True) as connection:
        rows = connection.execute('''SELECT r.definition_json,r.enabled,s.* FROM alert_rules r
            JOIN alert_state s ON s.rule_id=r.id ORDER BY r.id''').fetchall()
        return {'items': [{**json.loads(row['definition_json']), 'enabled': bool(row['enabled']), 'state': {key: row[key] for key in ('node_boot_id','last_sequence','last_reading_id','last_measured_at','breach_count','recovery_count','active_alert_id','last_outcome')}} for row in rows]}
