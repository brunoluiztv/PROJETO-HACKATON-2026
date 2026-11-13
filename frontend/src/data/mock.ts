import type { Profile, Reading, Result } from '../domain/model';
export type Scenario = 'ready' | 'empty' | 'error' | 'stale' | 'unknown';
export function sample(profile: Profile, sequence: number, time: number): Reading {
  let result: Result;
  if (profile.kind === 'numeric') result = {
    kind: 'numeric',
    value: Math.round((profile.id === 'temperature-demo' ? 8 + 14 * Math.sin(sequence / 8) : 49 + 28 * Math.sin(sequence / 7)) * 10) / 10
  };else if (profile.kind === 'categorical') result = {
    kind: 'categorical',
    value: ['a', 'b', 'c'][Math.floor(sequence / 4) % 3]
  };else result = {
    kind: 'boolean',
    value: Math.floor(sequence / 3) % 2 === 0
  };
  return {
    id: `demo-${profile.id}-${sequence}`,
    deviceId: 'esp32-demo',
    sensorId: `canal-${profile.id}`,
    profileId: profile.id,
    profileVersion: profile.version,
    sequence,
    measuredAt: time,
    receivedAt: time + 500,
    timeQuality: 'synchronized',
    source: 'simulation',
    quality: 'valid',
    result
  };
}
export function createStore(profiles: Profile[], now: number): Record<string, Reading[]> {
  return Object.fromEntries(profiles.map(p => [p.id, Array.from({
    length: 97
  }, (_, i) => sample(p, i + 1, now - (96 - i) * 900000 - i % 4 * 20000))]));
}
export function scenarioReadings(readings: Reading[], scenario: Scenario, now: number): Reading[] {
  if (scenario === 'empty') return [];
  if (scenario === 'stale') return readings.map(r => ({
    ...r,
    measuredAt: r.measuredAt === null ? null : r.measuredAt - 1800000,
    receivedAt: r.receivedAt - 1800000
  }));
  if (scenario === 'unknown') return readings.map(r => ({
    ...r,
    measuredAt: null,
    timeQuality: 'unknown'
  }));
  if (scenario === 'error') return [...readings.slice(0, -1), {
    ...readings[readings.length - 1],
    quality: 'sensor_error',
    result: null,
    measuredAt: now
  }];
  return readings;
}
