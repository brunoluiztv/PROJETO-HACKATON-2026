import type { Profile, Reading, Result } from '../domain/model';

export type AgeStatus = {
  status: 'fresh' | 'stale' | 'unknown' | 'no_data';
  age_seconds: number | null;
  reason?: string | null;
  observed_at?: string | null;
  reported_at?: string | null;
};
export type Channel = {
  channel_id: string;
  sensor_id: string;
  name: string;
  profile_id: string;
  profile_version: number;
  stale_after_seconds: number;
};
export type NodeDevice = {
  id: string;
  role: 'node';
  name: string;
  gateway_id: string;
  area_id: string;
  enabled?: boolean;
  current_boot_id: string | null;
  radio_contact: AgeStatus;
  channels: Channel[];
};
export type GatewayDevice = {
  id: string;
  role: 'gateway';
  name: string;
  communication: AgeStatus;
};
export type Device = NodeDevice | GatewayDevice;
export type LatestChannel = Channel & {
  selection: 'no_data' | 'reported_session' | 'single_session' | 'measured_time' | 'ambiguous_sessions';
  reading: unknown | null;
  freshness: AgeStatus;
};
export type Alert = {
  id: string;
  rule_id: string;
  node_id: string;
  channel_id: string;
  status: 'active' | 'resolved';
  opened_at: string;
  resolved_at: string | null;
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string';
const date = (value: unknown): number | null => {
  if (!string(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

export function normalizeProfile(value: unknown): Profile | null {
  if (!object(value) || !string(value.id) || !string(value.label) || !string(value.description) || !Number.isInteger(value.version)) return null;
  const base = { id: value.id, label: value.label, description: value.description, version: value.version as number };
  if (value.kind === 'numeric' && string(value.unit) && Number.isInteger(value.decimals) && (value.decimals as number) >= 0 && (value.decimals as number) <= 10) {
    const domain = Array.isArray(value.domain) && value.domain.length === 2 && value.domain.every(x => typeof x === 'number' && Number.isFinite(x)) ? value.domain as [number, number] : undefined;
    return { ...base, kind: 'numeric', unit: value.unit, decimals: value.decimals as number, domain };
  }
  if (value.kind === 'categorical' && object(value.choices)) {
    const choices: Record<string, { label: string; symbol: string }> = {};
    for (const [key, choice] of Object.entries(value.choices)) {
      if (object(choice) && string(choice.label) && string(choice.symbol)) choices[key] = { label: choice.label, symbol: choice.symbol };
    }
    return { ...base, kind: 'categorical', choices };
  }
  if (value.kind === 'boolean' && object(value.labels) && string(value.labels.yes) && string(value.labels.no)) {
    return { ...base, kind: 'boolean', labels: { yes: value.labels.yes, no: value.labels.no } };
  }
  return null;
}

export function normalizeReading(value: unknown): Reading | null {
  if (!object(value) || !string(value.id) || !string(value.node_id) || !string(value.channel_id) || !string(value.sensor_id) || !string(value.profile_id) || !Number.isInteger(value.profile_version) || !Number.isInteger(value.sequence)) return null;
  if (value.quality !== 'valid' && value.quality !== 'sensor_error') return null;
  if (value.source !== 'simulation' && value.source !== 'physical_sensor') return null;
  if (value.time_quality !== 'synchronized' && value.time_quality !== 'unknown') return null;
  const receivedAt = date(value.received_at);
  if (receivedAt === null) return null;
  let result: Result | null = null;
  if (object(value.result)) {
    const raw = value.result;
    if (raw.kind === 'numeric' && typeof raw.value === 'number' && Number.isFinite(raw.value)) result = { kind: 'numeric', value: raw.value };
    if (raw.kind === 'categorical' && string(raw.value)) result = { kind: 'categorical', value: raw.value };
    if (raw.kind === 'boolean' && typeof raw.value === 'boolean') result = { kind: 'boolean', value: raw.value };
  }
  return {
    id: value.id, deviceId: value.node_id, channelId: value.channel_id,
    sensorId: value.sensor_id, bootId: string(value.node_boot_id) ? value.node_boot_id : undefined,
    profileId: value.profile_id, profileVersion: value.profile_version as number,
    sequence: value.sequence as number, measuredAt: date(value.measured_at), receivedAt,
    timeQuality: value.time_quality, source: value.source, quality: value.quality, result
  };
}

export function apiBase(input: string): string {
  const url = new URL(input.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use um endereço HTTP ou HTTPS da API.');
  if (location.protocol === 'https:' && url.protocol === 'http:') throw new Error('Esta página HTTPS exige uma API HTTPS.');
  return url.toString().replace(/\/$/, '');
}

async function getJson(base: string, path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Não foi possível alcançar a API. Confira o endereço, a rede e o CORS.');
  }
  if (!response.ok) throw new Error(`A API respondeu HTTP ${response.status}.`);
  try { return await response.json(); } catch { throw new Error('A API retornou uma resposta inválida.'); }
}

function items(value: unknown): unknown[] {
  if (!object(value) || !Array.isArray(value.items)) throw new Error('Formato de resposta da API incompatível.');
  return value.items;
}

export async function loadCatalog(base: string, signal?: AbortSignal): Promise<{ devices: Device[]; profiles: Profile[] }> {
  const [devicesResponse, profilesResponse] = await Promise.all([
    getJson(base, '/api/v1/devices', signal), getJson(base, '/api/v1/profiles', signal)
  ]);
  const devices = items(devicesResponse).filter((d): d is Device => object(d) && string(d.id) && string(d.name) &&
    (d.role === 'gateway' || d.role === 'node' && Array.isArray(d.channels)));
  const profiles = items(profilesResponse).map(normalizeProfile).filter((p): p is Profile => p !== null);
  return { devices, profiles };
}

export async function loadLatest(base: string, nodeId: string, signal?: AbortSignal): Promise<LatestChannel[]> {
  const response = await getJson(base, `/api/v1/devices/${encodeURIComponent(nodeId)}/latest`, signal);
  if (!object(response) || !Array.isArray(response.channels)) throw new Error('Resposta de últimas leituras incompatível.');
  return response.channels as LatestChannel[];
}

export async function loadHistory(base: string, nodeId: string, channelId: string, fromAt: string, signal?: AbortSignal, cursor?: string): Promise<{ readings: Reading[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ node_id: nodeId, channel_id: channelId, from: fromAt, limit: '500' });
  if (cursor) params.set('cursor', cursor);
  const response = await getJson(base, `/api/v1/readings?${params}`, signal);
  if (!object(response)) throw new Error('Resposta do histórico incompatível.');
  return { readings: items(response).map(normalizeReading).filter((r): r is Reading => r !== null), nextCursor: string(response.next_cursor) ? response.next_cursor : null };
}

export async function loadUnknownTime(base: string, nodeId: string, channelId: string, signal?: AbortSignal): Promise<Reading[]> {
  const params = new URLSearchParams({ node_id: nodeId, channel_id: channelId, time_quality: 'unknown', limit: '100' });
  return items(await getJson(base, `/api/v1/readings?${params}`, signal)).map(normalizeReading).filter((r): r is Reading => r !== null);
}

export async function loadAlerts(base: string, nodeId: string, channelId: string, signal?: AbortSignal): Promise<Alert[]> {
  const params = new URLSearchParams({ node_id: nodeId, channel_id: channelId, limit: '100' });
  return items(await getJson(base, `/api/v1/alerts?${params}`, signal)).filter((a): a is Alert => object(a) && string(a.id) && string(a.rule_id) && string(a.opened_at) && (a.status === 'active' || a.status === 'resolved'));
}
