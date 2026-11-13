export type Choice = {
  label: string;
  symbol: string;
};
type BaseProfile = {
  id: string;
  version: number;
  label: string;
  description: string;
};
export type Profile = BaseProfile & ({
  kind: 'numeric';
  unit: string;
  decimals: number;
  domain?: [number, number];
} | {
  kind: 'categorical';
  choices: Record<string, Choice>;
} | {
  kind: 'boolean';
  labels: {
    yes: string;
    no: string;
  };
});
export type Result = {
  kind: 'numeric';
  value: number;
} | {
  kind: 'categorical';
  value: string;
} | {
  kind: 'boolean';
  value: boolean;
};
export type Reading = {
  id: string;
  deviceId: string;
  sensorId: string;
  channelId?: string;
  bootId?: string;
  profileId: string;
  profileVersion: number;
  sequence: number;
  measuredAt: number | null;
  receivedAt: number;
  timeQuality: 'synchronized' | 'unknown';
  source: 'simulation' | 'physical_sensor';
  quality: 'valid' | 'sensor_error';
  result: Result | null;
};
export function validReading(profile: Profile, reading: Reading): boolean {
  if (reading.profileId !== profile.id || reading.profileVersion !== profile.version || reading.quality !== 'valid') return false;
  const result = reading.result;
  if (!result || result.kind !== profile.kind) return false;
  if (result.kind === 'numeric') return Number.isFinite(result.value);
  if (result.kind === 'categorical' && profile.kind === 'categorical') return Object.hasOwn(profile.choices, result.value);
  return result.kind === 'boolean' && typeof result.value === 'boolean';
}
export function formatResult(profile: Profile, reading?: Reading): string {
  if (!reading) return 'Sem leitura';
  if (reading.quality === 'sensor_error') return 'Erro de aquisição';
  if (!validReading(profile, reading) || !reading.result) return 'Resultado indisponível';
  const r = reading.result;
  if (r.kind === 'numeric' && profile.kind === 'numeric') return `${r.value.toLocaleString('pt-BR', {
    minimumFractionDigits: profile.decimals,
    maximumFractionDigits: profile.decimals
  })}${profile.unit ? ` ${profile.unit}` : ''}`;
  if (r.kind === 'categorical' && profile.kind === 'categorical') return `${profile.choices[r.value].symbol} ${profile.choices[r.value].label}`;
  if (r.kind === 'boolean' && profile.kind === 'boolean') return r.value ? profile.labels.yes : profile.labels.no;
  return 'Resultado indisponível';
}
export function inPeriod(readings: Reading[], now: number, hours: number): Reading[] {
  return readings.filter(r => r.measuredAt !== null && r.measuredAt >= now - hours * 3600000 && r.measuredAt <= now).sort((a, b) => a.measuredAt! - b.measuredAt! || a.sequence - b.sequence);
}
export function latest(readings: Reading[]): Reading | undefined {
  // MVP: a single device/session per series. Acquisition sequence wins over delivery order.
  return readings.reduce<Reading | undefined>((last, r) => !last || r.sequence > last.sequence ? r : last, undefined);
}
export function numericDomain(profile: Profile, readings: Reading[]): [number, number] {
  if (profile.kind !== 'numeric') return [0, 1];
  const values = readings.filter(r => validReading(profile, r)).flatMap(r => r.result?.kind === 'numeric' ? [r.result.value] : []);
  let lo = Math.min(profile.domain?.[0] ?? Infinity, ...values),
    hi = Math.max(profile.domain?.[1] ?? -Infinity, ...values);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  return [lo, hi];
}
export function assessment(profile: Profile, reading: Reading | undefined, demoRule = false): {
  label: string;
  attention: boolean;
} {
  if (!reading) return {
    label: 'Aguardando primeira leitura',
    attention: false
  };
  if (!validReading(profile, reading)) return {
    label: 'Não avaliado: resultado inválido',
    attention: false
  };
  if (demoRule && profile.kind === 'numeric' && reading.result?.kind === 'numeric') {
    const low = reading.result.value < (profile.domain?.[0] ?? 0) + ((profile.domain?.[1] ?? 100) - (profile.domain?.[0] ?? 0)) * .3;
    return {
      label: low ? 'Abaixo do limiar de teste' : 'Dentro do critério de teste',
      attention: low
    };
  }
  return {
    label: 'Sem critério de avaliação definido',
    attention: false
  };
}
const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
export function toCsv(profile: Profile, readings: Reading[]): string {
  const header = ['id', 'dispositivo', 'sessao', 'canal', 'sensor', 'analise', 'versao', 'valor', 'unidade', 'qualidade', 'aquisicao_utc', 'recebimento_utc', 'qualidade_horario', 'origem'];
  return '\uFEFF' + [header, ...readings.map(r => [r.id, r.deviceId, r.bootId ?? '', r.channelId ?? '', r.sensorId, r.profileId, r.profileVersion, r.result?.value ?? '', profile.kind === 'numeric' ? profile.unit : '', r.quality, r.measuredAt === null ? '' : new Date(r.measuredAt).toISOString(), new Date(r.receivedAt).toISOString(), r.timeQuality, r.source])].map(row => row.map(cell).join(';')).join('\r\n');
}
