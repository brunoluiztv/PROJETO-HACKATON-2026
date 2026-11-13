"""Seleção comum para o dashboard e para o motor de alertas."""
from .readings import SORT_KEY


def select_latest(connection, node_id, channel_id, current_boot_id):
    params = (node_id, channel_id)
    if current_boot_id is not None:
        row = connection.execute('SELECT * FROM readings WHERE node_id=? AND channel_id=? AND node_boot_id=? ORDER BY sequence DESC LIMIT 1', (*params, current_boot_id)).fetchone()
        return row, 'reported_session'
    summary = connection.execute('SELECT COUNT(DISTINCT node_boot_id) AS sessions FROM readings WHERE node_id=? AND channel_id=?', params).fetchone()
    if summary['sessions'] == 1:
        row = connection.execute('SELECT * FROM readings WHERE node_id=? AND channel_id=? ORDER BY sequence DESC LIMIT 1', params).fetchone()
        return row, 'single_session'
    if summary['sessions'] > 1:
        candidates = connection.execute(f'''SELECT r.*, {SORT_KEY} AS sort_key FROM readings r
            WHERE r.node_id=? AND r.channel_id=? AND r.sequence=(
                SELECT MAX(s.sequence) FROM readings s WHERE s.node_id=r.node_id
                AND s.channel_id=r.channel_id AND s.node_boot_id=r.node_boot_id
            ) ORDER BY sort_key DESC''', params).fetchall()
        if all(c['measured_at'] is not None for c in candidates) and candidates[0]['sort_key'] != candidates[1]['sort_key']:
            return candidates[0], 'measured_time'
        return None, 'ambiguous_sessions'
    return None, 'no_data'
