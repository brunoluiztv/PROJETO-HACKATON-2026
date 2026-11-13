import { useEffect, useState } from 'react';
import { Sprout, LayoutDashboard, History, Bell, Cpu, BookOpen, ArrowDownToLine, RefreshCw, Copy, FlaskConical, ArrowUpRight, WifiOff, Pause, Play } from 'lucide-react';
import { profiles } from './domain/profiles';
import { assessment, formatResult, inPeriod, latest, toCsv, validReading } from './domain/model';
import { createStore, sample, scenarioReadings, type Scenario } from './data/mock';
import { dateLabel, HistoryChart, ReadingsTable } from './components/History';
import { ProjectGuide } from './components/ProjectGuide';
import { initTelegram } from './integrations/telegram';
const tabs = ([{
  id: 'overview',
  label: 'Visão geral',
  icon: LayoutDashboard
}, {
  id: 'history',
  label: 'Histórico',
  icon: History
}, {
  id: 'alerts',
  label: 'Alertas',
  icon: Bell
}, {
  id: 'device',
  label: 'Dispositivo',
  icon: Cpu
}, {
  id: 'guide',
  label: 'Projeto',
  icon: BookOpen
}] as const);
type Tab = typeof tabs[number]['id'];
const initialColor = new URLSearchParams(location.search).get('lote');
function tabFromHash(): Tab {
  const hash = location.hash.slice(1);
  if (['selo', 'graficos', 'usar', 'receita'].includes(hash) || !hash && initialColor) return 'guide';
  return tabs.some(t => t.id === hash) ? (hash as Tab) : 'overview';
}
export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash),
    [profileId, setProfileId] = useState(profiles[0].id);
  const [scenario, setScenario] = useState<Scenario>('ready'),
    [hours, setHours] = useState(6),
    [auto, setAuto] = useState(true),
    [rule, setRule] = useState(false);
  const [now, setNow] = useState(Date.now),
    [store, setStore] = useState(() => createStore(profiles, Date.now()));
  const [online, setOnline] = useState(navigator.onLine),
    [message, setMessage] = useState('');
  const profile = profiles.find(p => p.id === profileId)!;
  const readings = scenarioReadings(store[profile.id], scenario, now),
    last = latest(readings),
    evaluation = assessment(profile, last, rule);
  const filtered = inPeriod(readings, now, hours);
  const unknown = readings.filter(r => r.measuredAt === null);
  const numbers = filtered.filter(r => validReading(profile, r)).flatMap(r => r.result?.kind === 'numeric' ? [r.result.value] : []);
  const average = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null;
  function refresh() {
    const time = Date.now();
    setNow(time);
    setStore(current => Object.fromEntries(profiles.map(p => {
      const records = current[p.id];
      return [p.id, [...records, sample(p, (latest(records)?.sequence ?? 0) + 1, time)].slice(-1200)];
    })));
  }
  useEffect(() => {
    void initTelegram();
    const change = () => setTab(tabFromHash());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  useEffect(() => {
    if (!auto || scenario !== 'ready') return;
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [auto, scenario]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  async function share() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = tab;
    if (tab === 'guide' && initialColor && ['verde', 'amarelo', 'vermelho'].includes(initialColor)) url.searchParams.set('lote', initialColor);
    try {
      await navigator.clipboard.writeText(url.toString());
      setMessage('Link copiado. Os cenários são locais e não são compartilhados.');
    } catch {
      setMessage('Copie o endereço na barra do navegador para compartilhar.');
    }
  }
  function exportCsv() {
    const blob = new Blob([toCsv(profile, [...filtered, ...unknown])], {
        type: 'text/csv;charset=utf-8;'
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `agrosponge-${profile.id}-${hours}h.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('CSV exportado. Inclui o período e registros com horário desconhecido, quando houver.');
  }
  const timeline = <><HistoryChart profile={profile} readings={filtered} />{unknown.length > 0 && <p className="notice">{unknown.length} registros sem horário absoluto. Consulte a sequência na tabela; eles não são posicionados no gráfico temporal.</p>}</>;
  return <div className="app-shell">
    <a className="skip-link" href="#main" onClick={e => {
      e.preventDefault();
      document.getElementById('main')?.focus();
    }}>Pular para conteúdo</a>
    <aside className="sidebar"><a href="#overview" className="brand"><span className="brand-icon"><Sprout /></span><span>AgroSponge <b>RS</b><small>MONITORAMENTO NO CAMPO</small></span></a><div className="workspace"><span className="dot" /><div><strong>Área demonstrativa</strong><small>Hackathon · UERGS 2026</small></div></div><p className="nav-caption">ACOMPANHAMENTO</p><nav aria-label="Seções">{tabs.map(t => <a href={`#${t.id}`} key={t.id} aria-current={tab === t.id ? 'page' : undefined}><t.icon size={20} /><span>{t.label}</span></a>)}</nav><div className="sidebar-note"><Sprout size={22} /><strong>Do campo à informação.</strong><p>Acompanhe análises pelo celular ou computador.</p><button onClick={share}><Copy size={16} /> Compartilhar painel</button></div><small className="sidebar-footer">Protótipo · Perfis configuráveis</small></aside>
    <div className="main-shell"><header className="topbar"><span>Monitoramento <span className="muted">/ {tabs.find(t => t.id === tab)?.label}</span></span><span className="demo-tag"><FlaskConical size={15} /> DEMONSTRAÇÃO</span></header>
    <main id="main" tabIndex={-1}><div className="page-heading"><div><p className="eyebrow">TECNOLOGIA QUE APROXIMA</p><h1>{tab === 'overview' ? 'Um olhar sobre a sua área.' : tab === 'history' ? 'Cada leitura conta uma história.' : tab === 'alerts' ? 'O que merece sua atenção.' : tab === 'device' ? 'Sua unidade de monitoramento.' : 'Conheça o projeto da equipe.'}</h1><p>Uma experiência para diferentes análises. Os sensores ainda serão definidos.</p></div><button className="button secondary" onClick={share}><Copy size={17} /> Copiar link</button></div>
    <div className="simulation"><FlaskConical size={20} /><p><strong>Dados simulados.</strong> Nenhuma ESP32, API ou sensor está conectado. Os exemplos não representam uma análise validada.</p></div>
    {!online && <div className="notice"><WifiOff size={18} /> Navegador sem conexão detectada. A demonstração continua na memória; esta versão ainda não tem cache persistente.</div>}
    <section className="toolbar" aria-label="Configuração da demonstração"><label className="field">Análise<select value={profileId} onChange={e => {
              setProfileId(e.target.value);
              setRule(false);
            }}>{profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label className="field">Cenário<select value={scenario} onChange={e => setScenario((e.target.value as Scenario))}><option value="ready">Leituras disponíveis</option><option value="empty">Sem leituras</option><option value="error">Erro na aquisição</option><option value="stale">Sem atualização remota</option><option value="unknown">Horário desconhecido</option></select></label><div className="toolbar-buttons"><button className="icon-button" aria-label={auto ? 'Pausar novas amostras' : 'Retomar novas amostras'} aria-pressed={auto} onClick={() => setAuto(!auto)}>{auto ? <Pause size={18} /> : <Play size={18} />}</button><button className="button secondary" disabled={scenario !== 'ready'} onClick={refresh}><RefreshCw size={16} /> Atualizar</button></div></section>
    <p className="profile-description">{profile.description} <span>Perfil v{profile.version} · {profile.kind === 'numeric' ? 'Numérico' : profile.kind === 'categorical' ? 'Categórico' : 'Booleano'}</span></p>
    {scenario === 'stale' && <p className="notice">Sem atualização remota simulada há pelo menos 30 minutos. Isso não indica que a coleta na placa parou.</p>}
    {tab === 'guide' ? <ProjectGuide initialColor={initialColor} /> : <>
    {tab === 'overview' && <><section className="metrics" aria-label="Resumo"><article className="metric primary"><span>Último resultado</span><strong className="result-value">{formatResult(profile, last)}</strong><small>{last ? dateLabel(last.measuredAt) : 'Nenhum registro'} · {last ? 'Simulação' : 'Aguardando dados'}</small></article><article className="metric"><span>Avaliação da análise</span><strong className="status-value">{evaluation.label}</strong><small>{rule && profile.kind === 'numeric' ? 'Regra local demonstrativa, sem recomendação agronômica.' : 'Critérios dependem do método e da calibração.'}</small></article><article className="metric"><span>{profile.kind === 'numeric' ? 'Média do período' : 'Resultados no período'}</span><strong className="result-value">{profile.kind === 'numeric' ? average === null ? '—' : `${average.toLocaleString('pt-BR', {
                    maximumFractionDigits: 1
                  })} ${profile.unit}` : filtered.filter(r => validReading(profile, r)).length}</strong><small>{filtered.length} registros · últimas {hours} horas</small></article></section>
    <section className="panel"><div className="panel-head"><div><h2>Histórico da análise</h2><p>Leituras por horário de aquisição.</p></div><div className="periods" aria-label="Período">{[1, 6, 24].map(h => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h}h</button>)}</div></div>{timeline}<div className="panel-footer"><a href="#history">Consultar tabela acessível <ArrowUpRight size={15} /></a><button onClick={exportCsv} disabled={!filtered.length && !unknown.length}><ArrowDownToLine size={16} /> Exportar CSV</button></div></section>
    <div className="bottom-grid"><section className="panel"><div className="panel-head"><h2>Interpretação e alertas</h2><Bell size={20} /></div><p className="status-copy">{evaluation.label}</p><p className="muted">Esta versão não envia notificações. As ocorrências persistentes virão da API.</p><a href="#alerts" className="inline-link">Ver critérios da demonstração →</a></section><section className="panel device-summary"><div className="panel-head"><h2>Unidade de análise</h2><Cpu size={20} /></div><strong>ESP32 · Unidade demonstrativa</strong><p>{scenario === 'stale' ? 'Sem atualização remota simulada' : 'Origem dos dados: simulador no navegador'}</p><a href="#device" className="inline-link">Informações do dispositivo →</a></section></div></>}
    {tab === 'history' && <section className="panel"><div className="panel-head"><div><h2>Histórico e exportação</h2><p>O filtro utiliza o horário real de cada amostra.</p></div><label className="field">Período<select value={hours} onChange={e => setHours(Number(e.target.value))}>{[1, 6, 24].map(h => <option key={h} value={h}>{h} horas</option>)}</select></label></div>{timeline}<button className="button secondary" onClick={exportCsv} disabled={!filtered.length && !unknown.length}><ArrowDownToLine size={16} /> Exportar CSV</button><ReadingsTable profile={profile} readings={[...filtered, ...unknown]} /></section>}
    {tab === 'alerts' && <section className="panel"><div className="panel-head"><h2>Critérios de avaliação</h2><Bell size={22} /></div><p className="status-copy">{evaluation.label}</p><p>Os critérios finais serão definidos após a escolha do sensor, do método e da calibração.</p>{profile.kind === 'numeric' ? <label className="checkbox"><input type="checkbox" checked={rule} onChange={e => setRule(e.target.checked)} /> Aplicar regra de teste à última leitura (abaixo de 30% da escala demonstrativa)</label> : <p className="notice">Nenhuma regra de interpretação configurada para este perfil.</p>}<p className="muted">A regra serve apenas para testar a apresentação. Não aplica persistência, histerese ou envio de mensagens pelo Telegram.</p><div className="empty">Nenhuma ocorrência persistida. A integração de alertas será realizada na API.</div></section>}
    {tab === 'device' && <section className="panel"><div className="panel-head"><div><h2>ESP32 demonstrativa</h2><p>Informações de origem e capacidade desta versão.</p></div><Cpu size={26} /></div><dl className="device-data"><div><dt>Identificador</dt><dd>esp32-demo</dd></div><div><dt>Canal selecionado</dt><dd>{profile.id}</dd></div><div><dt>Sensor físico</dt><dd>A definir · não conectado</dd></div><div><dt>Última coleta simulada</dt><dd>{last ? dateLabel(last.measuredAt) : 'Sem leitura'}</dd></div><div><dt>Comunicação com a placa</dt><dd>Não implementada</dd></div><div><dt>Armazenamento</dt><dd>Memória temporária do navegador</dd></div><div><dt>Persistência na ESP32</dt><dd>Próxima etapa · capacidade a dimensionar</dd></div><div><dt>Sincronização e Telegram</dt><dd>Não conectados a este painel</dd></div></dl><p className="notice">Recarregar a página reinicia os exemplos. Falta de internet não ativa dados simulados em uma futura integração real: este painel está explicitamente no modo demonstração.</p></section>}
    </>}
    <footer><span><Sprout size={16} /> AgroSponge RS · UERGS 2026</span><span>{auto && scenario === 'ready' ? 'Amostras simuladas a cada 10 s' : 'Novas amostras pausadas'} · dados locais à sessão</span></footer></main></div>
    {message && <div className="toast" role="status">{message}<button aria-label="Fechar aviso" onClick={() => setMessage('')}>×</button></div>}
  </div>;
}
