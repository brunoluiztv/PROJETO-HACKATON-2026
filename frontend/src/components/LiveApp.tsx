import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Bell, BookOpen, Copy, Cpu, History, LayoutDashboard, RefreshCw, Sprout, Wifi, WifiOff } from 'lucide-react';
import { formatResult, inPeriod, toCsv, validReading, type Profile, type Reading } from '../domain/model';
import { apiBase, loadAlerts, loadCatalog, loadHistory, loadLatest, loadUnknownTime, normalizeReading, type Alert, type Device, type LatestChannel, type NodeDevice } from '../data/api';
import { dateLabel, HistoryChart, ReadingsTable } from './History';
import { ProjectGuide } from './ProjectGuide';

const tabs = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'alerts', label: 'Alertas', icon: Bell },
  { id: 'device', label: 'Dispositivo', icon: Cpu },
  { id: 'guide', label: 'Lavoura', icon: BookOpen }
] as const;
type Tab = typeof tabs[number]['id'];
const initialColor = new URLSearchParams(location.search).get('lote');
const initialNode = new URLSearchParams(location.search).get('node') ?? '';
const initialChannel = new URLSearchParams(location.search).get('channel') ?? '';
function tabFromHash(): Tab {
  const hash = location.hash.slice(1);
  if (['selo', 'graficos', 'usar', 'receita', 'triagem', 'simulacao'].includes(hash) || !hash && initialColor) return 'guide';
  return tabs.some(t => t.id === hash) ? hash as Tab : 'overview';
}
const contactLabel = (status?: string) => ({ fresh: 'Comunicação recente', stale: 'Comunicação atrasada', unknown: 'Comunicação desconhecida', no_data: 'Sem comunicação' })[status as 'fresh'] ?? 'Sem informação';
const pointLabel = (node: NodeDevice) => node.enabled === false ? 'Desativado' : contactLabel(node.radio_contact.status);
const freshnessLabel = (status?: string) => ({ fresh: 'Leitura recente', stale: 'Leitura antiga', unknown: 'Recência desconhecida', no_data: 'Sem leitura' })[status as 'fresh'] ?? 'Sem informação';
const when = (value: string | null | undefined) => value ? dateLabel(Date.parse(value)) : 'Horário desconhecido';
const initialUrl = localStorage.getItem('agrosponge-api-url') || import.meta.env.VITE_API_BASE_URL || (location.protocol === 'http:' ? `${location.protocol}//${location.hostname}:8000` : '');

export function LiveApp({ onDemo }: { onDemo: () => void }) {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [urlDraft, setUrlDraft] = useState(initialUrl);
  const [base, setBase] = useState(() => { try { return initialUrl ? apiBase(initialUrl) : ''; } catch { return ''; } });
  const [connectError, setConnectError] = useState('');
  const [catalog, setCatalog] = useState<{ devices: Device[]; profiles: Profile[] } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [nodeId, setNodeId] = useState(initialNode);
  const [channelId, setChannelId] = useState(initialChannel);
  const [hours, setHours] = useState(6);
  const [auto, setAuto] = useState(true);
  const [revision, setRevision] = useState(0);
  const [latestChannels, setLatestChannels] = useState<LatestChannel[]>([]);
  const [known, setKnown] = useState<Reading[]>([]);
  const [unknown, setUnknown] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsError, setAlertsError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [fromAt, setFromAt] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const pageKey = useRef('');
  const nodes = (catalog?.devices.filter((device): device is NodeDevice => device.role === 'node') ?? []);
  const node = nodes.find(n => n.id === nodeId) ?? nodes[0];
  const channel = node?.channels.find(c => c.channel_id === channelId) ?? node?.channels[0];
  const profile = catalog?.profiles.find(p => p.id === channel?.profile_id && p.version === channel.profile_version);
  const latestChannel = latestChannels.find(c => c.channel_id === channel?.channel_id);
  const last = latestChannel?.reading ? normalizeReading(latestChannel.reading) : null;
  const filtered = inPeriod(known, Date.now(), hours);
  const allRows = [...filtered, ...unknown];
  const valid = profile ? filtered.filter(r => validReading(profile, r)) : [];
  const numeric = valid.flatMap(r => r.result?.kind === 'numeric' ? [r.result.value] : []);
  const average = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;

  useEffect(() => {
    const change = () => setTab(tabFromHash());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!auto || !base) return;
    const timer = setInterval(() => setRevision(n => n + 1), 10000);
    return () => clearInterval(timer);
  }, [auto, base]);
  useEffect(() => {
    if (!base) return;
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError('');
    setCatalog(null);
    loadCatalog(base, controller.signal).then(setCatalog).catch(error => {
      if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : 'Falha ao carregar catálogo.');
    }).finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [base]);
  useEffect(() => {
    if (!base || !node || !channel) return;
    const controller = new AbortController();
    const start = new Date(Date.now() - hours * 3600000).toISOString();
    pageKey.current = `${base}|${node.id}|${channel.channel_id}|${start}`;
    setDataLoading(true);
    setDataError('');
    setLatestChannels([]);
    setKnown([]);
    setUnknown([]);
    setAlerts([]);
    setAlertsError('');
    setNextCursor(null);
    setFromAt(start);
    Promise.all([
      loadLatest(base, node.id, controller.signal),
      loadHistory(base, node.id, channel.channel_id, start, controller.signal),
      loadUnknownTime(base, node.id, channel.channel_id, controller.signal),
      loadAlerts(base, node.id, channel.channel_id, controller.signal).catch(() => {
        if (!controller.signal.aborted) setAlertsError('Ocorrências temporariamente indisponíveis.');
        return [];
      })
    ]).then(([latest, history, undated, occurrences]) => {
      setLatestChannels(latest);
      setKnown(history.readings);
      setNextCursor(history.nextCursor);
      setUnknown(undated);
      setAlerts(occurrences);
      setUpdatedAt(Date.now());
    }).catch(error => {
      if (!controller.signal.aborted) setDataError(error instanceof Error ? error.message : 'Falha ao consultar dados.');
    }).finally(() => { if (!controller.signal.aborted) setDataLoading(false); });
    return () => controller.abort();
  }, [base, node?.id, channel?.channel_id, hours, revision]);

  function connect() {
    try {
      const value = apiBase(urlDraft);
      localStorage.setItem('agrosponge-api-url', value);
      setConnectError('');
      setBase(value);
      setRevision(n => n + 1);
    } catch (error) { setConnectError(error instanceof Error ? error.message : 'Endereço inválido.'); }
  }
  async function loadMore() {
    if (!base || !node || !channel || !nextCursor || moreLoading) return;
    const requestKey = pageKey.current;
    setMoreLoading(true);
    try {
      const page = await loadHistory(base, node.id, channel.channel_id, fromAt, undefined, nextCursor);
      if (requestKey !== pageKey.current) return;
      setKnown(current => [...current, ...page.readings]);
      setNextCursor(page.nextCursor);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar mais leituras.'); }
    finally { setMoreLoading(false); }
  }
  function exportCsv() {
    if (!profile) return;
    const blob = new Blob([toCsv(profile, allRows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teko-${node?.id}-${channel?.channel_id}-${hours}h.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('CSV exportado com as leituras carregadas deste canal.');
  }
  async function share() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('mode', 'live');
    if (tab === 'guide' && initialColor && ['verde', 'amarelo', 'vermelho'].includes(initialColor)) url.searchParams.set('lote', initialColor);
    if (node) url.searchParams.set('node', node.id);
    if (channel) url.searchParams.set('channel', channel.channel_id);
    try { await navigator.clipboard.writeText(url.toString()); setMessage('Link do painel copiado.'); }
    catch { setMessage('Copie o endereço na barra do navegador.'); }
  }
  const result = profile && last ? formatResult(profile, last) : last ? 'Perfil indisponível' : 'Sem leitura';
  const timeline = profile ? <><HistoryChart profile={profile} readings={filtered} /><p className="muted">Histórico carregado: {filtered.length} leituras com horário · {unknown.length} sem horário. {nextCursor && 'Há mais registros no período.'}</p>{unknown.length > 0 && <p className="notice">Leituras sem horário de aquisição aparecem na tabela, sem posição no gráfico. A consulta mostra até 100 dessas leituras.</p>}</> : <div className="empty">Perfil do canal indisponível no catálogo da API.</div>;

  return <div className="app-shell">
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>Pular para conteúdo</a>
    <aside className="sidebar"><a href="#overview" className="brand"><span className="brand-icon"><Sprout /></span><span>tekó <b>biotech</b><small>MONITORAMENTO NO CAMPO</small></span></a><div className="workspace"><span className="dot" /><div><strong>{node?.area_id ?? 'Área de monitoramento'}</strong><small>{node?.name ?? 'Conecte sua API'}</small></div></div><p className="nav-caption">ACOMPANHAMENTO</p><nav aria-label="Seções">{tabs.map(item => <a href={`#${item.id}`} key={item.id} aria-current={tab === item.id ? 'page' : undefined}><item.icon size={20} /><span>{item.label}</span></a>)}</nav><div className="sidebar-note"><Sprout size={22} /><strong>Do campo à informação.</strong><p>Leituras recebidas pelo notebook da equipe.</p><button onClick={share}><Copy size={16} /> Compartilhar painel</button></div><small className="sidebar-footer">API de monitoramento · v1</small></aside>
    <div className="main-shell"><header className="topbar"><span>Monitoramento <span className="muted">/ {tabs.find(item => item.id === tab)?.label}</span></span><div className="topbar-actions"><span className="live-tag"><Wifi size={15} /> API</span><button className="mode-link" onClick={onDemo}>Ver demonstração</button></div></header>
      <main id="main" tabIndex={-1}>
        <div className="page-heading"><div><p className="eyebrow">DADOS DA SUA ÁREA</p><h1>{tab === 'overview' ? 'Sua área, de perto.' : tab === 'history' ? 'Histórico de leituras.' : tab === 'alerts' ? 'Ocorrências da área.' : tab === 'device' ? 'Unidade de monitoramento.' : 'Sua lavoura e a solução.'}</h1><p>{tab === 'guide' ? 'Triagem, simulação e funcionamento em páginas próprias.' : 'Escolha o nó e o canal para acompanhar as medições recebidas.'}</p></div><button className="button secondary share-button" onClick={share}><Copy size={17} /> Copiar link</button></div>
        {tab === 'guide' && <ProjectGuide initialColor={initialColor} />}
        {tab !== 'guide' && <form className="connection panel" onSubmit={event => { event.preventDefault(); connect(); }}><label className="field">Endereço da API no notebook<input type="url" value={urlDraft} onChange={event => setUrlDraft(event.target.value)} placeholder="http://192.168.1.10:8000" required /></label><button className="button secondary" type="submit">Conectar</button><p className="muted">No celular, use o IP do notebook na mesma rede. A API deve permitir a origem deste painel no CORS.</p>{connectError && <p className="error" role="alert">{connectError}</p>}</form>}
        {tab !== 'guide' && catalogLoading && <p className="notice" role="status">Carregando nós, canais e perfis…</p>}
        {tab !== 'guide' && catalogError && <p className="error" role="alert">{catalogError} <button className="inline-link" onClick={() => setBase('')}>Editar conexão</button></p>}
        {tab !== 'guide' && catalog && !nodes.length && <div className="empty">Nenhum nó cadastrado nesta API. Cadastre um nó e seus canais para começar.</div>}
        {tab !== 'guide' && node && channel && <>
          <section className="toolbar" aria-label="Seleção de medição"><label className="field">Área / nó<select value={node.id} onChange={event => { setNodeId(event.target.value); setChannelId(''); }}>{nodes.map(item => <option value={item.id} key={item.id}>{item.area_id} · {item.name}</option>)}</select></label><label className="field">Canal<select value={channel.channel_id} onChange={event => setChannelId(event.target.value)}>{node.channels.map(item => <option value={item.channel_id} key={item.channel_id}>{item.name}</option>)}</select></label><div className="toolbar-buttons"><button className="button secondary" onClick={() => setRevision(n => n + 1)} disabled={dataLoading}><RefreshCw size={16} /> Atualizar</button><button className="button secondary" aria-pressed={auto} onClick={() => setAuto(!auto)}>{auto ? 'Pausar' : 'Retomar'} atualização</button></div></section>
          <p className="profile-description">{profile?.description ?? 'Perfil desconhecido: interpretação indisponível.'} <span>{profile ? `${profile.label} · v${profile.version}` : `${channel.profile_id} · v${channel.profile_version}`}</span></p>
          {dataLoading && <p className="notice" role="status">Consultando leituras e ocorrências…</p>}
          {dataError && <p className="error" role="alert">{dataError} <button className="inline-link" onClick={() => setRevision(n => n + 1)}>Tentar novamente</button></p>}
          {!dataError && updatedAt && <div className="source-status"><span className={latestChannel?.freshness.status === 'fresh' ? 'state-dot fresh' : 'state-dot'} /><strong>{freshnessLabel(latestChannel?.freshness.status)}</strong><span>· {contactLabel(node.radio_contact.status)}</span><small>Consulta: {dateLabel(updatedAt)}</small></div>}
          {latestChannel?.selection === 'ambiguous_sessions' && <p className="notice">A API não consegue escolher a sessão mais recente deste canal. O histórico continua disponível, mas o último resultado fica indefinido.</p>}
          {latestChannel?.selection === 'reported_session' && !last && <p className="notice">Nova sessão informada; ainda não há leitura recebida nela.</p>}
          <>
            {tab === 'overview' && <><section className="metrics" aria-label="Resumo"><article className="metric primary"><span>Último resultado</span><strong className="result-value">{result}</strong><small>{last ? dateLabel(last.measuredAt) : 'Aguardando leitura'} · {last?.source === 'physical_sensor' ? 'Sensor físico' : last?.source === 'simulation' ? 'Simulação recebida pela API' : 'Sem origem'}</small></article><article className="metric"><span>Estado do canal</span><strong className="status-value">{freshnessLabel(latestChannel?.freshness.status)}</strong><small>{latestChannel?.freshness.status === 'stale' ? 'A última aquisição passou do prazo configurado.' : 'Recência calculada pela API.'}</small></article><article className="metric"><span>{profile?.kind === 'numeric' ? 'Média carregada' : 'Resultados carregados'}</span><strong className="result-value">{profile?.kind === 'numeric' ? average === null ? '—' : `${average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${profile.unit}` : valid.length}</strong><small>Últimas {hours} horas · {filtered.length} registros carregados</small></article></section><section className="panel"><div className="panel-head"><div><h2>Histórico da análise</h2><p>Leituras pelo horário de aquisição.</p></div><div className="periods" aria-label="Período">{[1, 6, 24].map(value => <button key={value} aria-pressed={hours === value} onClick={() => setHours(value)}>{value}h</button>)}</div></div>{timeline}<div className="panel-footer"><a href="#history">Ver tabela de leituras</a><button onClick={exportCsv} disabled={!allRows.length || !profile}><ArrowDownToLine size={16} /> Exportar CSV</button></div></section><div className="bottom-grid"><section className="panel"><h2>Ocorrências</h2><p className="status-copy">{alertsError ? 'Indisponíveis' : `${alerts.filter(alert => alert.status === 'active').length} ativas carregadas`}</p><p className="muted">Eventos avaliados e persistidos pela API.</p><a className="inline-link" href="#alerts">Ver ocorrências →</a></section><section className="panel device-summary"><h2>Comunicação</h2><p className="status-copy">{contactLabel(node.radio_contact.status)}</p><p className="muted">Último contato informado: {when(node.radio_contact.observed_at)}</p><a className="inline-link" href="#device">Ver dispositivo →</a></section></div></>}
            {tab === 'history' && <section className="panel"><div className="panel-head"><div><h2>Histórico e exportação</h2><p>Os dados são filtrados pela aquisição, quando o horário é conhecido.</p></div><label className="field">Período<select value={hours} onChange={event => setHours(Number(event.target.value))}>{[1, 6, 24].map(value => <option key={value} value={value}>{value} horas</option>)}</select></label></div>{timeline}<button className="button secondary" onClick={exportCsv} disabled={!allRows.length || !profile}><ArrowDownToLine size={16} /> Exportar CSV</button>{profile && <ReadingsTable profile={profile} readings={allRows} />}{nextCursor && <button className="button secondary load-more" onClick={loadMore} disabled={moreLoading}>{moreLoading ? 'Carregando…' : 'Carregar mais leituras'}</button>}</section>}
            {tab === 'overview' && <section className="panel"><h2>Pontos de monitoramento</h2><p className="muted">Estado de comunicação informado pela API. Um ponto sem contato não é necessariamente um ponto desativado.</p><div className="point-list">{nodes.map(item => <button key={item.id} onClick={() => { setNodeId(item.id); setChannelId(''); }}><span><strong>{item.name}</strong><small>{item.area_id} · {item.id}</small></span><span className="point-state">{pointLabel(item)}</span></button>)}</div></section>}
            {tab === 'alerts' && <section className="panel"><h2>Estado técnico do ponto</h2><dl className="device-data"><div><dt>Comunicação do nó</dt><dd>{pointLabel(node)}</dd></div><div><dt>Recência do canal</dt><dd>{freshnessLabel(latestChannel?.freshness.status)}</dd></div><div><dt>Desativação intencional</dt><dd>{node.enabled === false ? 'Sim' : node.enabled === true ? 'Não' : 'Não informada'}</dd></div></dl><p className="muted">A perda de comunicação e a desativação são estados diferentes. As ocorrências persistidas aparecem abaixo.</p></section>}
            {tab === 'alerts' && <section className="panel"><div className="panel-head"><div><h2>Ocorrências registradas</h2><p>Regras avaliadas no backend para este canal.</p></div><Bell size={22} /></div>{alertsError ? <p className="notice">{alertsError}</p> : alerts.length ? <ul className="alert-list">{alerts.map(alert => <li key={alert.id}><strong>{alert.status === 'active' ? '● Ativa' : '✓ Resolvida'} · {alert.rule_id}</strong><span>Início: {when(alert.opened_at)}</span>{alert.resolved_at && <span>Fim: {when(alert.resolved_at)}</span>}</li>)}</ul> : <div className="empty">Nenhuma ocorrência registrada para este canal.</div>}<p className="muted">Mostrando até 100 ocorrências recentes.</p></section>}
            {tab === 'device' && <section className="panel"><div className="panel-head"><div><h2>{node.name}</h2><p>Identificação e comunicação informadas pela API.</p></div><Cpu size={24} /></div><dl className="device-data"><div><dt>Área</dt><dd>{node.area_id}</dd></div><div><dt>Nó</dt><dd>{node.id}</dd></div><div><dt>Gateway</dt><dd>{node.gateway_id}</dd></div><div><dt>Canal / sensor</dt><dd>{channel.name} · {channel.sensor_id}</dd></div><div><dt>Sessão informada</dt><dd>{node.current_boot_id ?? 'Não informada'}</dd></div><div><dt>Contato por rádio</dt><dd>{contactLabel(node.radio_contact.status)}</dd></div><div><dt>Último contato</dt><dd>{when(node.radio_contact.observed_at)}</dd></div><div><dt>Última aquisição</dt><dd>{last ? dateLabel(last.measuredAt) : 'Sem leitura'}</dd></div><div><dt>Recebimento na API</dt><dd>{last ? dateLabel(last.receivedAt) : 'Sem leitura'}</dd></div></dl>{node.radio_contact.status !== 'fresh' && <p className="notice"><WifiOff size={18} /> O contato por rádio não está recente. Isso não determina, por si só, o estado do sensor.</p>}</section>}
          </>
        </>}
        {tab !== 'guide' && node && !node.channels.length && <div className="empty">Este nó não possui canais cadastrados.</div>}
        <footer><span><Sprout size={16} /> tekó biotech · UERGS 2026</span><span>API: {base || 'não configurada'} · {auto ? 'consulta a cada 10 s' : 'consulta pausada'}</span></footer>
      </main></div>
    {message && <div className="toast" role="status">{message}<button aria-label="Fechar aviso" onClick={() => setMessage('')}>×</button></div>}
  </div>;
}
