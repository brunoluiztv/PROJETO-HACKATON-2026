import { useEffect, useId, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownToLine, ArrowRight, Bell, Check, CheckCheck, ChevronDown, CircleHelp, Copy, Cpu, Droplets, FlaskConical, Leaf, Link, MapPin, RefreshCw, Sprout, TrendingUp, TriangleAlert, Wifi, WifiOff, X } from 'lucide-react';
import { createReadings, exportReadings, formatTime, LIMIT, type Reading, type Scenario } from './mock';
import './style.css';

function Chart({ readings }: { readings: Reading[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const gradient = useId().replace(/:/g, '');
  const W = 920, H = 240, left = 35, right = 15, top = 12, bottom = 24;
  const x = (i: number) => left + i / Math.max(1, readings.length - 1) * (W - left - right);
  const y = (v: number) => H - bottom - (v / 100) * (H - top - bottom);
  const path = readings.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.value)}`).join(' ');
  const index = selected === null ? readings.length - 1 : Math.min(selected, readings.length - 1);
  const active = readings[index];
  return <><div className="chart-detail"><span>{selected === null ? 'Última leitura' : 'Leitura selecionada'} · {formatTime(active.time)}</span><strong>{active.value.toLocaleString('pt-BR')} <small>% do sinal</small></strong></div>
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Histórico do sinal simulado. Última leitura: ${readings.at(-1)?.value}%. Limiar demonstrativo de 30%.`} onPointerLeave={() => setSelected(null)} onPointerMove={e => { const box = e.currentTarget.getBoundingClientRect(); setSelected(Math.max(0, Math.min(readings.length - 1, Math.round((((e.clientX - box.left) / box.width) * W - left) / (W - left - right) * (readings.length - 1))))); }}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#83b199" stopOpacity=".3"/><stop offset="100%" stopColor="#83b199" stopOpacity=".015"/></linearGradient></defs>
      {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="#ebeee9"/><text x="0" y={y(v) + 4} fill="#879087" fontSize="11">{v}</text></g>)}
      <path d={`${path} L${x(readings.length - 1)},${y(0)} L${left},${y(0)} Z`} fill={`url(#${gradient})`}/>
      <line x1={left} x2={W - right} y1={y(LIMIT)} y2={y(LIMIT)} stroke="#c6974b" strokeDasharray="5 5"/>
      <path d={path} fill="none" stroke="#327b59" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      <line x1={x(index)} x2={x(index)} y1={top} y2={y(0)} stroke="#3c765a" strokeDasharray="3 4" opacity=".4"/>
      <circle cx={x(index)} cy={y(active.value)} r="5" fill="#2b7051" stroke="white" strokeWidth="3"/>
      {[0, .25, .5, .75, 1].map(p => { const i = Math.round(p * (readings.length - 1)); return <text key={p} x={x(i)} y={H - 3} textAnchor={p === 0 ? 'start' : p === 1 ? 'end' : 'middle'} fill="#879087" fontSize="11">{formatTime(readings[i].time)}</text>; })}
    </svg></>;
}
function App() {
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [period, setPeriod] = useState(6);
  const [tab, setTab] = useState('overview');
  const [toast, setToast] = useState('');
  const [help, setHelp] = useState(false);
  const readings = useMemo(() => createReadings(now, scenario), [now, scenario]);
  const filtered = readings.slice(-(period * 12 + 1));
  const last = readings[readings.length - 1];
  const attention = scenario === 'attention', offline = scenario === 'offline';
  const average = filtered.reduce((sum, r) => sum + r.value, 0) / filtered.length;
  useEffect(() => { if (!auto || offline) return; const timer = setInterval(() => setNow(Date.now()), 10_000); return () => clearInterval(timer); }, [auto, offline]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelp(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  async function share() { try { await navigator.clipboard.writeText(window.location.href.split('#')[0]); setToast('Link copiado. Você pode enviá-lo pelo Telegram.'); } catch { setToast('Copie o endereço na barra do navegador para compartilhar.'); } }
  function navigate(id: string) { setTab(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={() => navigate('overview')}><span className="brand-mark"><Sprout size={25}/></span><span>campo<span className="brand-light">vivo</span><small>TECNOLOGIA QUE CULTIVA</small></span></a>
      <div className="workspace"><span className="farm-icon"><Leaf size={20}/></span><div><strong>Área demonstrativa</strong><small>Projeto de hackathon</small></div></div>
      <span className="nav-label">ACOMPANHAMENTO</span>
      <nav aria-label="Navegação principal">{[{ id: 'overview', label: 'Visão geral', icon: Activity }, { id: 'alerts', label: 'Alertas', icon: Bell }, { id: 'device', label: 'Dispositivo', icon: Cpu }].map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(id)}><Icon size={19}/>{label}{id === 'alerts' && attention && <span className="nav-count">1</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="share-note"><Link size={18}/><strong>Seu campo, mais perto.</strong><p>Acompanhe este painel pelo link recebido no Telegram.</p><button onClick={share}>Copiar link do painel <ArrowRight size={15}/></button></div><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17}/> Sobre a demonstração</button><div className="sidebar-foot"><span className="dot"/> Protótipo · v0.1</div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Monitoramento <span>/</span> <strong>Visão geral</strong></div><div className="top-actions"><span className="public-label"><Link size={14}/> Acesso por link</span><span className="demo-pill"><FlaskConical size={14}/> DEMONSTRAÇÃO</span></div></header>
      <main id="overview">
        <div className="page-heading"><div><div className="eyebrow"><span className="dot"/> CONECTADO AO CAMPO</div><h1>Um olhar sobre o seu cultivo.</h1><p>Leituras, histórico e alertas em um só lugar.</p></div><button className="button secondary share-button" onClick={share}><Copy size={16}/> Compartilhar painel</button></div>
        <div className="simulation-notice"><FlaskConical size={18}/><p><strong>Modo demonstração.</strong> Dados fictícios simulam uma ESP32 com sensor de umidade.</p><button onClick={() => setHelp(true)} aria-label="Entenda a simulação"><CircleHelp size={17}/></button></div>
        <div className="section-toolbar"><div className="area-title"><MapPin size={17}/><strong>Área 01</strong><span>Horta demonstrativa</span></div><div className="updated"><span className={`dot ${offline ? 'gray' : ''}`}/>{offline ? 'Sem novas leituras' : `Atualizado às ${formatTime(last.time)}`}<button aria-label="Atualizar leituras" onClick={() => { if (offline) { setToast('Dispositivo simulado sem sinal. Escolha outro cenário para retomar.'); return; } setNow(Date.now()); setToast('Leituras simuladas atualizadas.'); }}><RefreshCw size={15}/></button></div></div>
        <section className="metrics" aria-label="Resumo das leituras">
          <article className={`metric current ${attention ? 'warn' : ''}`}><div className="metric-label"><span>Sinal do sensor</span><Droplets size={20}/></div><div className="metric-number">{last.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}<span>%</span></div><div className="metric-footer"><span className="mini-badge">{offline ? 'Última leitura' : attention ? 'Abaixo do limiar' : 'Dentro da faixa'}</span><span>Índice simulado</span></div></article>
          <article className="metric"><div className="metric-label"><span>Situação da área</span>{attention ? <TriangleAlert size={20}/> : offline ? <WifiOff size={20}/> : <CheckCheck size={20}/>}</div><div className={`status-word ${attention ? 'amber-text' : ''}`}>{offline ? 'Sem sinal' : attention ? 'Atenção' : 'Tudo certo'}<span className={`status-dot ${attention ? 'amber' : offline ? 'gray' : ''}`}/></div><p>{offline ? 'Aguardando reconexão do dispositivo.' : attention ? 'O sinal está abaixo do limiar de 30%.' : 'Nenhum alerta ativo neste momento.'}</p></article>
          <article className="metric"><div className="metric-label"><span>Média do período</span><TrendingUp size={20}/></div><div className="metric-number">{average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}<span>%</span></div><div className="metric-footer"><span>Últimas {period} horas</span><span>{filtered.length} leituras</span></div></article>
        </section>
        <section className="panel history"><div className="panel-heading"><div><h2>Evolução do sinal</h2><p>Uma visão das leituras ao longo do tempo.</p></div><div className="periods" aria-label="Período do gráfico">{[1, 6, 24].map(h => <button key={h} aria-pressed={period === h} className={period === h ? 'selected' : ''} onClick={() => setPeriod(h)}>{h}h</button>)}</div></div><Chart readings={filtered}/><div className="chart-footer"><div className="legend"><span><i/> Sinal simulado</span><span><i className="dashed"/> Limiar de alerta · 30%</span></div><button className="text-button" onClick={() => { exportReadings(filtered); setToast('CSV do período exportado.'); }}><ArrowDownToLine size={15}/> Exportar CSV</button></div></section>
        <div className="bottom-grid">
          <section className="panel alerts" id="alerts"><div className="panel-heading"><div><h2><Bell size={18}/> Alertas recentes</h2><p>Acompanhe o que merece sua atenção.</p></div><span className={`count-badge ${attention ? 'warning-badge' : ''}`}>{attention ? '1 ativo' : '0 ativos'}</span></div>{attention && <div className="alert-row alert-active"><span className="alert-icon"><TriangleAlert size={18}/></span><div><strong>Sinal abaixo do limiar</strong><p>Leitura de {last.value.toLocaleString('pt-BR')}% · Limiar de 30%</p><small>Área 01 · {formatTime(last.time)} · Simulação</small></div><span className="event-status">Ativo</span></div>}{!attention && <div className="all-good"><span><Check size={20}/></span><div><strong>{offline ? 'Sem alerta de medição ativo' : 'Tudo tranquilo por aqui'}</strong><p>{offline ? 'O estado atual aguarda uma nova leitura.' : 'As últimas leituras estão na faixa demonstrativa.'}</p></div></div>}<div className="alert-row"><span className="alert-icon resolved"><Check size={18}/></span><div><strong>Sinal restabelecido</strong><p>A leitura voltou à faixa demonstrativa.</p><small>Área 01 · {formatTime(readings[183].time)} · Simulação</small></div><span className="event-status resolved-text">Resolvido</span></div><div className="panel-note"><Bell size={14}/> No sistema integrado, os avisos chegarão pelo Telegram.</div></section>
          <section className="panel device" id="device"><div className="panel-heading"><div><h2><Cpu size={18}/> Unidade de análise</h2><p>O ponto de conexão com a sua área.</p></div><span className={`device-badge ${offline ? 'offline-badge' : ''}`}>{offline ? <WifiOff size={13}/> : <Wifi size={13}/>} {offline ? 'Sem sinal' : 'Simulado'}</span></div><div className="device-identity"><div className="chip"><Cpu size={31}/><span className={`dot ${offline ? 'gray' : ''}`}/></div><div><strong>ESP32 · Unidade 01</strong><span>Sensor de umidade analógico</span></div></div><dl><div><dt>Identificador</dt><dd>esp32-01</dd></div><div><dt>Última leitura</dt><dd>{offline ? 'Há 12 minutos' : formatTime(last.time)}</dd></div><div><dt>Leitura bruta</dt><dd>{last.raw} ADC</dd></div><div><dt>Origem</dt><dd>Dados fictícios</dd></div></dl></section>
        </div>
        <section className="demo-controls" aria-label="Controles da demonstração"><div className="controls-title"><FlaskConical size={18}/><div><strong>Experimente o protótipo</strong><span>Alterne o cenário para visualizar o comportamento do painel.</span></div></div><div className="controls-actions"><label className="select-wrap"><span className="sr-only">Cenário simulado</span><select value={scenario} onChange={e => { setScenario(e.target.value as Scenario); setNow(Date.now()); }}><option value="normal">Cenário normal</option><option value="attention">Sinal em atenção</option><option value="offline">Dispositivo sem sinal</option></select><ChevronDown size={15}/></label><button className="auto-control" role="switch" aria-checked={auto} onClick={() => setAuto(!auto)}><span className={`switch ${auto ? 'on' : ''}`}><i/></span> Atualizar a cada 10s</button></div></section>
        <footer><span><Sprout size={15}/> Campo Vivo <span className="footer-separator">/</span> Da leitura ao cuidado.</span><span>Protótipo de hackathon · Dados simulados</span></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><Check size={18}/>{toast}<button aria-label="Fechar mensagem" onClick={() => setToast('')}><X size={16}/></button></div>}
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="modal-close" autoFocus aria-label="Fechar explicação" onClick={() => setHelp(false)} onKeyDown={e => { if (e.key === 'Tab') e.preventDefault(); }}><X size={20}/></button><span className="modal-icon"><FlaskConical size={28}/></span><h2 id="help-title">Uma ideia ganhando vida.</h2><p>Este painel usa dados fictícios para demonstrar o fluxo entre uma ESP32, uma API e um bot no Telegram.</p><p>O sensor de umidade será usado para simular o sinal de um imunossensor. O índice exibido e o limiar de 30% são demonstrativos e não representam uma medição de biomarcadores.</p><p>O link do painel pode ser compartilhado livremente. A conexão com o hardware e o envio de alertas pelo Telegram serão integrados nas próximas etapas.</p></section></div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
