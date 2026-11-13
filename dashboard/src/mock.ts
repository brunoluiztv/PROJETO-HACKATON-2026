export type Scenario = 'normal' | 'attention' | 'offline';
export type Reading = { id: string; time: number; value: number; raw: number };
export const LIMIT = 30;
export function createReadings(now: number, scenario: Scenario): Reading[] {
  const end = scenario === 'offline' ? now - 12 * 60_000 : now;
  return Array.from({ length: 289 }, (_, i) => {
    let value = 60 + Math.sin(i / 16) * 8 + Math.cos(i / 5) * 3;
    if (i > 170 && i < 183) value = 24 + Math.sin(i) * 2;
    if (i > 282) value = scenario === 'attention' ? 26 - (i - 283) * .6 : 64 + Math.sin(end / 10_000 + i) * 1.5;
    value = Math.round(value * 10) / 10;
    return { id: `mock-${end}-${i}`, time: end - (288 - i) * 300_000, value, raw: Math.round(3200 - value * 20) };
  });
}
export const formatTime = (time: number) => new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export function exportReadings(readings: Reading[]) {
  const csv = '\uFEFFhorario_utc;sinal_simulado_percentual;adc;origem\n' + readings.map(r => `${new Date(r.time).toISOString()};${r.value};${r.raw};moisture_sensor_simulation`).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = 'campo-vivo-leituras-simuladas.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
