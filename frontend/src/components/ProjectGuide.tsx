import { useState } from 'react';
import { LAUDOS, FAQ, RECEITA, LITROS_POR_SACO, CONSUMO_DIA_LITROS } from '../../../web/js/content.js';
type Color = keyof typeof LAUDOS;
export function ProjectGuide({
  initialColor
}: {
  initialColor: string | null;
}) {
  const [bags, setBags] = useState(15);
  const [color, setColor] = useState<Color | null>(initialColor && Object.hasOwn(LAUDOS, initialColor) ? (initialColor as Color) : null);
  const report = color ? LAUDOS[color] : null;
  return <div className="guide-grid">
    <div className="notice full">Conteúdo da demonstração original da equipe. As estimativas e os laudos abaixo não foram validados nesta implementação e não são resultados dos sensores.</div>
    <section className="panel"><div className="panel-head"><div><h2>Calculadora do projeto</h2><p>Estimativa com parâmetros da demonstração.</p></div></div><label className="field">Quantidade de sacos<input type="number" min="1" max="500" value={bags} onChange={e => setBags(Math.min(500, Math.max(1, Math.round(Number(e.target.value)) || 1)))} /></label><div className="calculation"><strong>{(bags * LITROS_POR_SACO).toLocaleString('pt-BR')} L</strong><span>Estimativa de {Math.round(bags * LITROS_POR_SACO / CONSUMO_DIA_LITROS)} dias, conforme parâmetros originais.</span></div><p className="muted">{LITROS_POR_SACO} L por saco · consumo de referência: {CONSUMO_DIA_LITROS} L/dia. Não representa medição de água.</p></section>
    <section className="panel"><div className="panel-head"><div><h2>Selo demonstrativo</h2><p>Seleção manual preservada dos links do bot.</p></div></div><div className="color-options">{(['verde', 'amarelo', 'vermelho'] as Color[]).map((c, i) => <button key={c} aria-pressed={color === c} onClick={() => setColor(c)}>{['●', '◆', '▲'][i]} {c}</button>)}</div>{report ? <div className="legacy-report"><h3>{report.titulo}</h3><p>{report.fazer}</p><p>{report.extra}</p><strong>Texto demonstrativo original; não constitui laudo validado ou interpretação do canal selecionado.</strong></div> : <p className="empty">Escolha uma cor para consultar o conteúdo original.</p>}</section>
    <section className="panel"><div className="panel-head"><h2>Orientações da equipe</h2></div>{FAQ.map(item => <details key={item.p}><summary>{item.p}</summary><p>{item.r}</p></details>)}</section>
    <section className="panel"><div className="panel-head"><h2>Composição demonstrativa</h2></div><ul className="recipe">{RECEITA.map(item => <li key={item.classe}><strong>{item.g} g</strong><span>{item.nome}</span></li>)}</ul><p className="muted">Conteúdo original do projeto, independente do monitoramento.</p></section>
  </div>;
}
