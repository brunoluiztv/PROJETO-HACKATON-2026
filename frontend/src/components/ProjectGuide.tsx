import { useEffect, useState } from 'react';
import { CloudRain, Droplets, Leaf, Wind } from 'lucide-react';

type Page = 'triage' | 'simulation' | 'recipe';
type Triage = { area: string; soil: string; crop: string; irrigation: string };
const emptyTriage: Triage = { area: '', soil: '', crop: '', irrigation: '' };
const storageKey = 'teko-triagem-v1';

function pageFromHash(): Page {
  const hash = location.hash.slice(1);
  if (hash === 'simulacao' || hash === 'graficos') return 'simulation';
  if (['receita', 'selo', 'usar'].includes(hash)) return 'recipe';
  return 'triage';
}
function savedTriage(): Triage {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (value && typeof value === 'object') return {
      area: String(value.area ?? ''), soil: String(value.soil ?? ''),
      crop: String(value.crop ?? ''), irrigation: String(value.irrigation ?? '')
    };
  } catch { /* armazenamento indisponível ou dado antigo */ }
  return emptyTriage;
}
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProjectGuide({ initialColor }: { initialColor: string | null }) {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [triage, setTriage] = useState<Triage>(savedTriage);
  const [scenario, setScenario] = useState<'drought' | 'flood' | 'wind'>('drought');
  const [waterLiters, setWaterLiters] = useState('');
  const [tariff, setTariff] = useState('');
  const [waterLevel, setWaterLevel] = useState(50);
  const [strongWind, setStrongWind] = useState(false);
  useEffect(() => {
    const change = () => setPage(pageFromHash());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(triage)); } catch { /* formulário continua funcional */ }
  }, [triage]);
  const liters = Math.max(0, Number(waterLiters) || 0);
  const tariffValue = Number(tariff);
  const estimatedSavings = tariff !== '' && Number.isFinite(tariffValue) && tariffValue >= 0 ? liters / 1000 * tariffValue : null;
  function change(field: keyof Triage, value: string) { setTriage(current => ({ ...current, [field]: value })); }

  return <div className="project-flow">
    <nav className="project-nav" aria-label="Etapas do projeto">
      <a href="#triagem" aria-current={page === 'triage' ? 'page' : undefined}>1. Triagem</a>
      <a href="#simulacao" aria-current={page === 'simulation' ? 'page' : undefined}>2. Simulação</a>
      <a href="#receita" aria-current={page === 'recipe' ? 'page' : undefined}>3. Receita e solução</a>
    </nav>

    {page === 'triage' && <section className="panel project-page" aria-labelledby="triage-title">
      <p className="eyebrow">PERFIL DA LAVOURA</p>
      <h2 id="triage-title">Conte sobre a sua área</h2>
      <p className="muted">Preencha tudo nesta página. As respostas ajudam a contextualizar a simulação e ficam salvas apenas neste navegador.</p>
      <form className="triage-form" onSubmit={event => { event.preventDefault(); location.hash = 'simulacao'; }}>
        <label className="field">Nome da área ou lavoura<input value={triage.area} onChange={event => change('area', event.target.value)} placeholder="Ex.: horta do sítio" maxLength={80} /></label>
        <label className="field">Tipo de solo<select value={triage.soil} onChange={event => change('soil', event.target.value)}><option value="">Selecione</option><option>Argiloso</option><option>Arenoso</option><option>Misto</option><option>Não sei informar</option></select></label>
        <label className="field">Cultura<input value={triage.crop} onChange={event => change('crop', event.target.value)} placeholder="Ex.: milho, feijão, hortaliças" maxLength={80} /></label>
        <fieldset className="triage-choice"><legend>Possui irrigação?</legend><label><input type="radio" name="irrigation" checked={triage.irrigation === 'Sim'} onChange={() => change('irrigation', 'Sim')} /> Sim</label><label><input type="radio" name="irrigation" checked={triage.irrigation === 'Não'} onChange={() => change('irrigation', 'Não')} /> Não</label><label><input type="radio" name="irrigation" checked={triage.irrigation === 'Não sei'} onChange={() => change('irrigation', 'Não sei')} /> Não sei</label></fieldset>
        <button className="button primary-button" type="submit">Ver simulação da área →</button>
      </form>
      <p className="notice">Esta triagem descreve a lavoura. Ela ainda não calcula recomendações agronômicas nem altera as leituras físicas da API.</p>
    </section>}

    {page === 'simulation' && <div className="project-page">
      <div className="simulation-heading"><div><p className="eyebrow">FUNCIONAMENTO DA FERRAMENTA</p><h2>Simule um cenário</h2><p className="muted">Valores inseridos por você para entender a apresentação do portal. Nenhum resultado desta tela é medição do sensor.</p></div><a className="inline-link" href="#triagem">Editar triagem</a></div>
      <div className="context-strip"><strong>{triage.area || 'Área sem nome'}</strong><span>Solo: {triage.soil || 'não informado'}</span><span>Cultura: {triage.crop || 'não informada'}</span><span>Irrigação: {triage.irrigation || 'não informada'}</span></div>
      <div className="scenario-tabs" role="group" aria-label="Cenário climático">
        <button aria-pressed={scenario === 'drought'} onClick={() => setScenario('drought')}><Droplets size={18} /> Estiagem</button>
        <button aria-pressed={scenario === 'flood'} onClick={() => setScenario('flood')}><CloudRain size={18} /> Alagamento / pós-enchente</button>
        <button aria-pressed={scenario === 'wind'} onClick={() => setScenario('wind')}><Wind size={18} /> Vendaval</button>
      </div>
      <section className="panel"><h3>Estado apresentado da planta</h3><div className="plant-simulation"><div className="plant-illustration" aria-hidden="true"><Leaf size={62} /><span style={{ height: `${waterLevel}%` }} /></div><div><strong>Sem avaliação física do caule</strong><p>O desenho usa apenas o nível de água que você ajusta abaixo. O estado real da planta dependerá dos sensores e do método definidos pela equipe.</p><label className="field">Nível de água no pote, simulado: {waterLevel}%<input type="range" min="0" max="100" value={waterLevel} onChange={event => setWaterLevel(Number(event.target.value))} /></label><small>Este percentual representa a capacidade do pote na simulação. Não representa umidade do solo nem sinal do caule.</small></div></div></section>
      <section className="panel"><h3>{scenario === 'flood' ? 'Alagamento e pós-enchente' : scenario === 'wind' ? 'Ventos fortes e vendavais' : 'Estiagem'}</h3>{scenario === 'flood' ? <p>Registre um volume de referência para visualizar litros e economia hipotética. A qualidade da água e o aproveitamento após a enchente ainda exigem avaliação.</p> : scenario === 'wind' ? <><p>Ventos fortes podem afetar o ponto de monitoramento e interromper o envio. Este protótipo mostra uma observação manual; um alerta automático dependerá de medição ou fonte meteorológica definida.</p><label className="checkbox"><input type="checkbox" checked={strongWind} onChange={event => setStrongWind(event.target.checked)} /> Ventos fortes observados nesta área</label>{strongWind && <p className="notice">Observação registrada nesta simulação. Confira o estado físico do ponto e a última comunicação no painel de monitoramento.</p>}</> : <p>Use o volume de referência abaixo para explorar uma estimativa. O consumo e o benefício real dependem da lavoura e do sistema adotado.</p>}
        {scenario !== 'wind' && <><div className="economy-inputs"><label className="field">Água considerada na simulação (L)<input type="number" min="0" step="0.1" inputMode="decimal" value={waterLiters} onChange={event => setWaterLiters(event.target.value)} placeholder="Informe um volume" /></label><label className="field">Custo de referência da água (R$/m³)<input type="number" min="0" step="0.01" inputMode="decimal" value={tariff} onChange={event => setTariff(event.target.value)} placeholder="Informe sua referência" /></label></div>
        <div className="economy-metrics"><div><span>Volume informado</span><strong>{liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</strong></div><div><span>Valor equivalente estimado</span><strong>{estimatedSavings === null ? '—' : money(estimatedSavings)}</strong></div></div><p className="muted">Cálculo ilustrativo: litros ÷ 1.000 × valor informado por m³. O valor não é economia comprovada.</p></>}
      </section>
    </div>}

    {page === 'recipe' && <div className="project-page">
      <p className="eyebrow">RECEITA E COMPONENTES</p><h2>Receita e funcionamento da solução</h2><p className="muted">Pote, água e célula microbiana são apresentados separadamente. A equipe ainda precisa fechar a montagem e validar as medições.</p>
      <section className="panel"><h3>1. Pote de barro e água</h3><p>Esta parte representa o recipiente e o nível de água acompanhado na simulação. Capacidade, instalação e materiais finais ainda serão especificados pela equipe.</p></section>
      <section className="panel"><h3>2. Célula microbiana</h3><p>É um módulo distinto do pote. A composição, a forma de leitura e o significado dos sinais dependem do protótipo físico e da validação técnica.</p></section>
      <section className="panel"><h3>Receita e montagem</h3><div className="empty">A receita da tekó biotech está em definição. Assim que a equipe fechar materiais, quantidades e etapas, esta página poderá exibir o passo a passo.</div></section>
      {initialColor && <p className="notice">Este link veio da demonstração antiga do selo. A versão atual da solução não usa essa classificação por cor.</p>}
    </div>}
  </div>;
}
