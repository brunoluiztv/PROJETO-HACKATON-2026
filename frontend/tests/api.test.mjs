import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProfile, normalizeReading } from '../.test-build-api/data/api.js';

test('API result mapping keeps session, channel, zero, false and missing acquisition time', () => {
  const base = {
    id: 'reading-1', node_id: 'node-demo-01', node_boot_id: 'boot-a', channel_id: 'signal-01',
    sensor_id: 'sensor-1', profile_id: 'signal-demo', profile_version: 1, sequence: 0,
    received_at: '2026-11-13T12:00:00Z', measured_at: null, time_quality: 'unknown',
    quality: 'valid', source: 'physical_sensor', result: { kind: 'numeric', value: 0 }
  };
  const numeric = normalizeReading(base);
  assert.equal(numeric?.result?.value, 0);
  assert.equal(numeric?.bootId, 'boot-a');
  assert.equal(numeric?.channelId, 'signal-01');
  assert.equal(numeric?.measuredAt, null);
  assert.equal(numeric?.source, 'physical_sensor');
  assert.equal(normalizeReading({ ...base, result: { kind: 'boolean', value: false } })?.result?.value, false);
  assert.equal(normalizeReading({ ...base, received_at: 'bad timestamp' }), null);
});

test('catalog profiles preserve each result type and reject unsupported definitions', () => {
  assert.equal(normalizeProfile({ id: 'n', version: 1, label: 'N', description: '', kind: 'numeric', unit: '%', decimals: 1 })?.kind, 'numeric');
  assert.equal(normalizeProfile({ id: 'c', version: 1, label: 'C', description: '', kind: 'categorical', choices: { a: { label: 'A', symbol: '●' } } })?.kind, 'categorical');
  assert.equal(normalizeProfile({ id: 'b', version: 1, label: 'B', description: '', kind: 'boolean', labels: { yes: 'Sim', no: 'Não' } })?.kind, 'boolean');
  assert.equal(normalizeProfile({ id: 'n', version: 1, label: 'N', description: '', kind: 'numeric', unit: '%', decimals: 100 }), null);
});
