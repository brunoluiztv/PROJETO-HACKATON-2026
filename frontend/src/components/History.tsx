import { formatResult, numericDomain, validReading, type Profile, type Reading } from '../domain/model';
export const dateLabel = (time: number | null) => time === null ? 'Horário desconhecido' : new Date(time).toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});
export function HistoryChart({
  profile,
  readings
}: {
  profile: Profile;
  readings: Reading[];
}) {
  if (!readings.length) return <div className="empty">Nenhuma leitura com horário conhecido neste período.</div>;
  if (profile.kind !== 'numeric') {
    const groups = profile.kind === 'categorical' ? Object.entries(profile.choices).map(([key, c]) => ({
      key,
      label: `${c.symbol} ${c.label}`
    })) : [{
      key: 'true',
      label: profile.labels.yes
    }, {
      key: 'false',
      label: profile.labels.no
    }];
    const valid = readings.filter(r => validReading(profile, r));
    return <div className="distribution" aria-label="Distribuição dos resultados no período">{groups.map(g => {
        const count = valid.filter(r => String(r.result?.value) === g.key).length;
        return <div key={g.key}><div><strong>{g.label}</strong><span>{count} leituras</span></div><meter min="0" max={Math.max(1, valid.length)} value={count} aria-label={g.label} /></div>;
      })}<p className="muted">Contagem de resultados válidos. A sequência dos eventos está na tabela.</p></div>;
  }
  const [lo, hi] = numericDomain(profile, readings),
    W = 900,
    H = 260,
    left = 66,
    right = 22,
    top = 22,
    bottom = 40;
  const start = readings[0].measuredAt!,
    end = readings.at(-1)!.measuredAt!;
  const x = (t: number) => left + (t - start) / Math.max(1, end - start) * (W - left - right);
  const y = (v: number) => H - bottom - (v - lo) / (hi - lo) * (H - top - bottom);
  let path = '',
    previous: Reading | null = null;
  const points = readings.flatMap(r => {
    if (!validReading(profile, r) || r.result?.kind !== 'numeric') {
      previous = null;
      return [];
    }
    const v = r.result.value;
    path += `${previous && r.measuredAt! - previous.measuredAt! <= 20 * 60000 ? 'L' : 'M'}${x(r.measuredAt!)},${y(v)} `;
    previous = r;
    return [{
      r,
      v
    }];
  });
  return <figure className="chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Histórico de ${profile.label}, em ${profile.unit}. Consulte os valores na tabela abaixo.`}>
    {[0, .25, .5, .75, 1].map(f => {
        const v = lo + (hi - lo) * f;
        return <g key={f}><line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".12" /><text x={left - 12} y={y(v) + 4} textAnchor="end">{v.toLocaleString('pt-BR', {
              maximumFractionDigits: 1
            })}</text></g>;
      })}
    <path d={path} fill="none" stroke="#327b59" strokeWidth="3" strokeLinejoin="round" />
    {points.map(({
        r,
        v
      }) => <circle key={r.id} cx={x(r.measuredAt!)} cy={y(v)} r={points.length > 50 ? 2 : 4} fill="#327b59"><title>{dateLabel(r.measuredAt)}: {formatResult(profile, r)}</title></circle>)}
    <text x={left} y={H - 10}>{dateLabel(start)}</text><text x={W - right} y={H - 10} textAnchor="end">{dateLabel(end)}</text>
  </svg><figcaption><strong>{profile.label}</strong> ({profile.unit}). {profile.description} {profile.unit === '%' ? 'O percentual corresponde a este perfil; só representa nível de água ou sinal do caule se o canal estiver identificado dessa forma.' : ''} {readings.some(r => r.source === 'physical_sensor') && readings.some(r => r.source === 'simulation') ? 'Origens: sensor físico e simulação.' : readings.some(r => r.source === 'physical_sensor') ? 'Origem: sensor físico cadastrado no canal.' : 'Origem: simulação.'} Interrupções superiores a 20 minutos não são conectadas.</figcaption></figure>;
}
export function ReadingsTable({
  profile,
  readings
}: {
  profile: Profile;
  readings: Reading[];
}) {
  return <div className="table-wrap"><table><caption>Leituras de {profile.label} · {readings.length} registros</caption><thead><tr><th scope="col">Coleta</th><th scope="col">Resultado</th><th scope="col">Qualidade</th><th scope="col">Origem</th></tr></thead><tbody>{[...readings].reverse().map(r => <tr key={r.id}><td>{dateLabel(r.measuredAt)}<small>Sequência {r.sequence}</small></td><td>{formatResult(profile, r)}</td><td>{r.quality === 'sensor_error' ? 'Erro de aquisição' : validReading(profile, r) ? 'Válido' : 'Incompatível'}</td><td>{r.source === 'simulation' ? 'Simulação' : 'Sensor físico'}</td></tr>)}</tbody></table>{!readings.length && <p className="empty">Nenhum registro disponível.</p>}</div>;
}
