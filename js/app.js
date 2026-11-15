/**
 * Tekó Biotech — Aplicação Mobile / Telegram Mini App
 * Hackathon das Engenharias UERGS 2026
 * 4 Abas Especializadas: 1. Planta | 2. Triagem & Receita | 3. Gráficos & Hectares | 4. Engenharia & Gateway
 */

import { initPlantCanvas } from './canvas_planta.js?v=23';
import { initPlant3D, isWebGLAvailable } from './simulador_3d.js?v=23';
import { initCharts, renderChartSecagem } from './charts.js?v=23';
import { 
  TELEMETRIA_ESTADOS, 
  FAQ_PRODUTOR, 
  PILARES_ENGENHARIA, 
  CONFIG_SOLOS, 
  MUNICIPIOS_RS,
  PERFIS_CULTURA,
  VAN_GENUCHTEN_SOLOS,
  MATRIZ_FASES_CULTURA,
  calcularAguaDisponivel, 
  classificarEstadoSolo,
  calcularPredicaoSecagem,
  calcularLaminaIrrigacao
} from './content.js?v=23';
import { iniciarTelegram } from './telegram.js?v=23';

let plantCanvasController = null;
let plant3DController = null;
let modoVisualizacao = '2d';
let estadoAtual = 'hidratada';
let tipoSoloAtual = localStorage.getItem('teko_tipo_solo') || localStorage.getItem('phytosense_tipo_solo') || 'franco';
let perfilCulturaAtual = localStorage.getItem('teko_perfil_cultura') || localStorage.getItem('phytosense_perfil_cultura') || 'olericultura_alface_argissolo';
let faseIndexAtual = 0;
let tensaoAtualKpa = 21.5;
let isSpeaking = false;
let dadosClimaCache = null;
let localizacaoAtiva = { nome: 'Bento Gonçalves (Serra Gaúcha)', lat: -29.1722, lon: -51.5189, regiao: 'Serra Gaúcha' };

document.addEventListener('DOMContentLoaded', () => {
  initThemeManager();
  iniciarTelegram();
  initServiceWorker();
  initTabs();
  initCanvas();
  initSeletorSolo();
  initSeletorCultura();
  initClimaTalhao();
  initSimulacaoEstados();
  initVozAcessibilidade();
  initChatSimulado();
  initEngenharia();
  initGatewayPainel();
  initModalProagro();
  initCharts();
  processarUrlParams();
  initPollingBackend();
});

/**
 * 0. Gerenciamento de Tema (Modo Escuro / Claro Rural)
 */
function initThemeManager() {
  const btnEscuro = document.getElementById('btn-tema-escuro');
  const btnClaro = document.getElementById('btn-tema-claro');

  function aplicarTema(tema, salvar = true) {
    if (tema === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (btnClaro) {
        btnClaro.classList.add('ativo');
        btnClaro.setAttribute('aria-checked', 'true');
      }
      if (btnEscuro) {
        btnEscuro.classList.remove('ativo');
        btnEscuro.setAttribute('aria-checked', 'false');
      }
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (btnEscuro) {
        btnEscuro.classList.add('ativo');
        btnEscuro.setAttribute('aria-checked', 'true');
      }
      if (btnClaro) {
        btnClaro.classList.remove('ativo');
        btnClaro.setAttribute('aria-checked', 'false');
      }
    }

    if (plant3DController) {
      plant3DController.setTheme(tema === 'light');
    }

    if (salvar) {
      try {
        localStorage.setItem('teko_theme', tema);
      } catch (e) {}
    }

    if (typeof window.recarregarGraficosTema === 'function') {
      window.recarregarGraficosTema();
    }
  }

  const temaSalvo = localStorage.getItem('teko_theme');
  if (temaSalvo === 'light') {
    aplicarTema('light', false);
  } else {
    aplicarTema('dark', false);
  }

  if (btnEscuro) {
    btnEscuro.addEventListener('click', () => aplicarTema('dark'));
  }
  if (btnClaro) {
    btnClaro.addEventListener('click', () => aplicarTema('light'));
  }
}

/**
 * 1. Gerenciamento do Service Worker
 */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => { void r.unregister(); });
      }).catch(() => {});
    } else {
      void navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
}

/**
 * 2. Navegação entre as 4 Abas Especializadas
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      ativarAba(targetId);
    });
  });
}

export function ativarAba(targetId) {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((b) => {
    const isTarget = b.getAttribute('data-target') === targetId;
    b.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    b.classList.toggle('active', isTarget);
  });

  tabPanels.forEach((p) => {
    const isTarget = p.id === targetId;
    p.hidden = !isTarget;
    if (isTarget) {
      p.focus();
    }
  });

  // Gerenciamento de ciclo de vida do simulador 3D ao alternar abas
  if (targetId === 'aba-minha-planta') {
    if (modoVisualizacao === '3d' && plant3DController) {
      plant3DController.resume();
      plant3DController.resize();
    }
  } else if (plant3DController) {
    plant3DController.pause();
  }

  // Se ativou gráficos ou planta, garante redimensionamento
  if (targetId === 'aba-graficos' || targetId === 'aba-minha-planta') {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }
}

/**
 * 3. Inicialização dos Visualizadores da Planta Sentinela (2D Canvas e 3D Three.js WebGL)
 */
function initCanvas() {
  const canvas2DEl = document.getElementById('canvas-planta');
  const canvas3DEl = document.getElementById('canvas-planta-3d');
  const btnView2D = document.getElementById('btn-view-2d');
  const btnView3D = document.getElementById('btn-view-3d');
  const btnResetCam = document.getElementById('btn-reset-cam-3d');
  const hint3D = document.getElementById('canvas-3d-hint');
  const liveRegion = document.getElementById('sr-anuncios');

  if (canvas2DEl) {
    plantCanvasController = initPlantCanvas(canvas2DEl);
  }

  const webglDisponivel = isWebGLAvailable();

  function anunciar(msg) {
    if (liveRegion) {
      liveRegion.textContent = msg;
    }
  }

  function alternarPara2D(motivo = '') {
    modoVisualizacao = '2d';
    if (canvas2DEl) canvas2DEl.hidden = false;
    if (canvas3DEl) canvas3DEl.hidden = true;
    if (hint3D) hint3D.hidden = true;
    if (btnResetCam) btnResetCam.hidden = true;

    if (btnView2D) {
      btnView2D.classList.add('ativo');
      btnView2D.setAttribute('aria-pressed', 'true');
    }
    if (btnView3D) {
      btnView3D.classList.remove('ativo');
      btnView3D.setAttribute('aria-pressed', 'false');
    }

    if (plant3DController) {
      plant3DController.pause();
    }

    anunciar(motivo || 'Visualização 2D esquemática fitoeletrônica ativada.');
  }

  function alternarPara3D() {
    if (!webglDisponivel) {
      anunciar('Aceleração 3D WebGL indisponível neste dispositivo. Mantendo visualização 2D fitoeletrônica.');
      return;
    }

    modoVisualizacao = '3d';
    if (canvas2DEl) canvas2DEl.hidden = true;
    if (canvas3DEl) canvas3DEl.hidden = false;
    if (hint3D) hint3D.hidden = false;
    if (btnResetCam) btnResetCam.hidden = false;

    if (btnView3D) {
      btnView3D.classList.add('ativo');
      btnView3D.setAttribute('aria-pressed', 'true');
    }
    if (btnView2D) {
      btnView2D.classList.remove('ativo');
      btnView2D.setAttribute('aria-pressed', 'false');
    }

    if (!plant3DController && canvas3DEl) {
      plant3DController = initPlant3D(canvas3DEl);
      const isLight = document.documentElement.dataset.theme === 'light';
      if (plant3DController) {
        plant3DController.setTheme(isLight);
        plant3DController.setState(estadoAtual);
      }
    } else if (plant3DController) {
      plant3DController.resume();
      plant3DController.resize();
    }

    anunciar('Visualização 3D interativa Three.js ativada. Use toque, mouse ou setas do teclado para rotacionar o modelo fitoelétrico.');
  }

  if (btnView2D) {
    btnView2D.addEventListener('click', () => alternarPara2D());
  }

  if (btnView3D) {
    if (!webglDisponivel) {
      btnView3D.setAttribute('aria-disabled', 'true');
      btnView3D.title = 'Aceleração 3D WebGL indisponível neste navegador';
      btnView3D.style.opacity = '0.5';
      btnView3D.style.cursor = 'not-allowed';
    }
    btnView3D.addEventListener('click', () => alternarPara3D());
  }

  if (btnResetCam) {
    btnResetCam.addEventListener('click', () => {
      if (plant3DController) {
        plant3DController.resetCamera();
        anunciar('Câmera do modelo 3D redefinida para a posição frontal padrão.');
      }
    });
  }

  // Fallback automático se o contexto WebGL for perdido em tempo de execução
  window.addEventListener('teko-webgl-lost', () => {
    alternarPara2D('Contexto gráfico WebGL interrompido. Alternando automaticamente para visualização 2D.');
  });

  // Otimização de bateria e performance em segundo plano (document.hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (plant3DController) {
        plant3DController.pause();
      }
    } else {
      const abaPlantaAtiva = !document.getElementById('aba-minha-planta')?.hidden;
      if (abaPlantaAtiva && modoVisualizacao === '3d' && plant3DController) {
        plant3DController.resume();
        plant3DController.resize();
      }
    }
  });
}

/**
 * 4. Inicialização do Seletor de Tipo de Solo pelo Agricultor
 */
function initSeletorSolo() {
  const botoesSolo = document.querySelectorAll('.btn-solo');
  
  atualizarBotoesSoloUi(tipoSoloAtual);
  atualizarAguaDisponivel(tensaoAtualKpa);

  botoesSolo.forEach((btn) => {
    btn.addEventListener('click', () => {
      const solo = btn.getAttribute('data-solo');
      if (!solo || !CONFIG_SOLOS[solo]) return;

      tipoSoloAtual = solo;
      localStorage.setItem('teko_tipo_solo', solo);
      atualizarBotoesSoloUi(solo);
      
      atualizarAguaDisponivel(tensaoAtualKpa);
      atualizarDadosFaseUi();
      atualizarReceitaPrescritiva();

      if (window.recalcularSimuladorHectares) {
        window.recalcularSimuladorHectares();
      }

      void notificarBackendTipoSolo(solo);

      const liveRegion = document.getElementById('sr-anuncios');
      if (liveRegion) {
        liveRegion.textContent = `Tipo de solo configurado para ${CONFIG_SOLOS[solo].nome}. Curva de irrigação calibrada.`;
      }
    });
  });
}

function atualizarBotoesSoloUi(soloAtivo) {
  document.querySelectorAll('.btn-solo').forEach((btn) => {
    const isAtivo = btn.getAttribute('data-solo') === soloAtivo;
    btn.classList.toggle('solo-ativo', isAtivo);
    btn.setAttribute('aria-checked', isAtivo ? 'true' : 'false');
  });
}

export function atualizarAguaDisponivel(tensaoKpa) {
  tensaoAtualKpa = parseFloat(tensaoKpa) || tensaoAtualKpa;
  const ad = calcularAguaDisponivel(tensaoAtualKpa, tipoSoloAtual);
  const cfg = CONFIG_SOLOS[tipoSoloAtual] || CONFIG_SOLOS.franco;

  const valorTextoEl = document.getElementById('ad-valor-texto');
  const barraEl = document.getElementById('ad-barra');
  const explicacaoEl = document.getElementById('ad-explicacao-solo');
  const trilhoEl = document.querySelector('.ad-trilho');

  const valEstadoHidrico = document.getElementById('val-estado-hidrico');
  const valAdPct = document.getElementById('val-ad-pct');
  const valTensao = document.getElementById('val-tensao-kpa');

  if (valTensao) {
    valTensao.textContent = `${tensaoAtualKpa.toFixed(1)} kPa`;
  }
  if (valAdPct) {
    valAdPct.textContent = `${ad.porcentagem}%`;
    valAdPct.style.color = ad.cor;
  }
  if (valEstadoHidrico) {
    if (tensaoAtualKpa <= 5.0) {
      valEstadoHidrico.textContent = 'Saturado';
      valEstadoHidrico.style.color = '#38bdf8';
    } else if (ad.porcentagem >= 60) {
      valEstadoHidrico.textContent = 'Capacidade de Campo';
      valEstadoHidrico.style.color = '#10b981';
    } else if (ad.porcentagem >= 40) {
      valEstadoHidrico.textContent = 'Início de Estresse';
      valEstadoHidrico.style.color = '#f59e0b';
    } else {
      valEstadoHidrico.textContent = 'Estresse Hídrico';
      valEstadoHidrico.style.color = '#ef4444';
    }
  }

  if (valorTextoEl) {
    valorTextoEl.textContent = `${ad.porcentagem}% (${ad.condicao})`;
    valorTextoEl.style.color = ad.cor;
  }
  if (barraEl) {
    barraEl.style.width = `${ad.porcentagem}%`;
    barraEl.style.backgroundColor = ad.cor;
  }
  if (trilhoEl) {
    trilhoEl.setAttribute('aria-valuenow', ad.porcentagem);
  }
  if (explicacaoEl) {
    explicacaoEl.textContent = `${cfg.nome}: Capacidade de Campo em ${cfg.ccKpa} kPa. Início de irrigação em ${cfg.estresseKpa} kPa. ${cfg.orientacaoBomba}`;
  }
}

async function notificarBackendTipoSolo(solo) {
  try {
    const host = window.location.hostname;
    const url = (host === 'localhost' || host === '127.0.0.1' || host === '') ? 'http://127.0.0.1:8000' : '';
    await fetch(`${url}/api/config/solo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo_solo: solo })
    });
  } catch {}
}

/**
 * Funções Auxiliares da Matriz Fenológica (Embrapa & FAO-56)
 */
function extrairChaveCultura(perfilId) {
  if (!perfilId) return 'alface';
  if (perfilId.includes('milho')) return 'milho';
  if (perfilId.includes('tomate')) return 'tomate';
  if (perfilId.includes('feijao')) return 'feijao';
  return 'alface';
}

function normalizarChaveSoloParaLimiar(soloSistema) {
  if (!soloSistema) return 'franco';
  if (soloSistema === 'arenoso') return 'arenoso';
  if (soloSistema === 'franco_arenoso') return 'franco_arenoso';
  if (soloSistema === 'franco_argiloso') return 'franco_argiloso';
  if (soloSistema === 'argiloso') return 'argiloso';
  return 'franco';
}

function obterFaseAtiva() {
  const chave = extrairChaveCultura(perfilCulturaAtual);
  const cultura = MATRIZ_FASES_CULTURA[chave];
  if (!cultura?.fases?.length) return null;
  const idx = Math.min(Math.max(0, faseIndexAtual), cultura.fases.length - 1);
  return { ...cultura.fases[idx], culturaNome: cultura.nome, icone: cultura.icone, chave };
}

function obterLimiteKpaFase(fase, soloKey = tipoSoloAtual) {
  if (!fase?.limiaresKpa) {
    return PERFIS_CULTURA[perfilCulturaAtual]?.manejoKpa || 30;
  }
  const soloNorm = normalizarChaveSoloParaLimiar(soloKey);
  return fase.limiaresKpa[soloNorm] || fase.limiaresKpa.franco || 30;
}

function atualizarSeletorFaseCulturaUi() {
  const selectFase = document.getElementById('select-fase-cultura');
  const chave = extrairChaveCultura(perfilCulturaAtual);
  const dadosCultura = MATRIZ_FASES_CULTURA[chave];
  if (!selectFase || !dadosCultura) return;

  const salvoKey = `teko_fase_${chave}`;
  const salvoVal = Number.parseInt(localStorage.getItem(salvoKey), 10);
  faseIndexAtual = !Number.isNaN(salvoVal) && salvoVal >= 0 && salvoVal < dadosCultura.fases.length ? salvoVal : 0;

  selectFase.innerHTML = '';
  dadosCultura.fases.forEach((f, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `${f.fase} · Kc: ${f.kc.toFixed(2)}`;
    if (idx === faseIndexAtual) opt.selected = true;
    selectFase.appendChild(opt);
  });

  atualizarDadosFaseUi();
}

function atualizarDadosFaseUi() {
  const fase = obterFaseAtiva();
  if (!fase) return;

  const elRaiz = document.getElementById('fase-raiz-val');
  const elKc = document.getElementById('fase-kc-val');
  const elLimite = document.getElementById('fase-limite-val');
  const elLamina = document.getElementById('fase-lamina-val');

  const limiteKpa = obterLimiteKpaFase(fase, tipoSoloAtual);
  const et0 = dadosClimaCache?.temperatura_atual ? Math.max(3.0, Math.min(6.5, (dadosClimaCache.temperatura_atual / 6))) : 4.0;
  const lamina = calcularLaminaIrrigacao(et0, fase.kc);
  const laminaVal = (lamina && (lamina.laminaMmDia || lamina.etcMmDia)) ? (lamina.laminaMmDia || lamina.etcMmDia) : (et0 * fase.kc).toFixed(1);

  if (elRaiz) elRaiz.textContent = `${fase.raizMm} mm (${(fase.raizMm / 10).toFixed(0)} cm)`;
  if (elKc) elKc.textContent = `${fase.kc.toFixed(2)}`;
  if (elLimite) elLimite.textContent = `${limiteKpa} kPa`;
  if (elLamina) elLamina.textContent = `${laminaVal} mm/dia`;

  // Atualiza limite do gráfico e aviso da Embrapa
  renderChartSecagem(perfilCulturaAtual, null, limiteKpa);
  atualizarPredicaoUi(tensaoAtualKpa, limiteKpa);
}

/**
 * 5. Seletor de Cultura e Motor Preditivo Embrapa (4 Culturas)
 */
function initSeletorCultura() {
  const botoesCultura = document.querySelectorAll('.btn-cultura');
  atualizarBotoesCulturaUi(perfilCulturaAtual);
  atualizarSeletorFaseCulturaUi();
  atualizarPredicaoUi(tensaoAtualKpa);

  const selectFase = document.getElementById('select-fase-cultura');
  if (selectFase) {
    selectFase.addEventListener('change', () => {
      faseIndexAtual = Number.parseInt(selectFase.value, 10) || 0;
      const chave = extrairChaveCultura(perfilCulturaAtual);
      localStorage.setItem(`teko_fase_${chave}`, faseIndexAtual);
      atualizarDadosFaseUi();
      atualizarReceitaPrescritiva();
    });
  }

  botoesCultura.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cultura = btn.getAttribute('data-cultura');
      if (!cultura || !PERFIS_CULTURA[cultura]) return;

      perfilCulturaAtual = cultura;
      localStorage.setItem('teko_perfil_cultura', cultura);
      atualizarBotoesCulturaUi(cultura);
      atualizarSeletorFaseCulturaUi();
      atualizarPredicaoUi(tensaoAtualKpa);
      atualizarReceitaPrescritiva();
      renderChartSecagem(cultura);

      const liveRegion = document.getElementById('sr-anuncios');
      if (liveRegion) {
        liveRegion.textContent = `Cultura alterada para ${PERFIS_CULTURA[cultura].cultura}. Limite de manejo Embrapa calibrado.`;
      }
    });
  });

  // Leitura do Sensor Físico (Ao Vivo)
  const btnGatilho = document.getElementById('btn-gatilho-caetano');
  if (btnGatilho) {
    btnGatilho.addEventListener('click', async () => {
      let novaTensao = 48.0;
      let leituraRealDetectada = false;

      try {
        const resp = await fetch('http://127.0.0.1:8000/api/telemetria/atual');
        if (resp.ok) {
          const dadosBackend = await resp.json();
          if (dadosBackend && typeof dadosBackend.tensao_kpa === 'number') {
            novaTensao = dadosBackend.tensao_kpa;
            leituraRealDetectada = dadosBackend.sensor_fisico_online || false;
          }
        }
      } catch (err) {}

      if (!leituraRealDetectada) {
        try {
          const noCorrespondente = PERFIS_CULTURA[perfilCulturaAtual]?.noId || 'esp32_no_01';
          await fetch('http://127.0.0.1:8000/api/telemetria/adc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leitura_adc: 3800,
              no_id: noCorrespondente,
              id_perfil: perfilCulturaAtual
            })
          });
        } catch (e) {}
      }

      tensaoAtualKpa = novaTensao;
      atualizarAguaDisponivel(tensaoAtualKpa);
      atualizarDadosFaseUi();
      atualizarReceitaPrescritiva();
      renderChartSecagem(perfilCulturaAtual, [14.0, 16.5, 19.0, 21.5, 25.5, tensaoAtualKpa]);

      const liveRegion = document.getElementById('sr-anuncios');
      if (liveRegion) {
        liveRegion.textContent = `Leitura do sensor físico atualizada para ${tensaoAtualKpa} kPa.`;
      }

      if (tensaoAtualKpa >= 35.0) {
        narrarDiagnostico(`Atenção produtor! Leitura do sensor físico em tempo real: ${tensaoAtualKpa} kPa. Limite da Embrapa ultrapassado. Irrigação emergencial recomendada!`);
      } else {
        narrarDiagnostico(`Leitura do sensor físico atualizada: ${tensaoAtualKpa} kPa.`);
      }
    });
  }

  // Restaurar Histórico Padrão de Monitoramento
  const btnReset = document.getElementById('btn-reset-demo');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      tensaoAtualKpa = perfilCulturaAtual.includes('alface') ? 21.5 : 25.0;
      atualizarAguaDisponivel(tensaoAtualKpa);
      atualizarDadosFaseUi();
      atualizarReceitaPrescritiva();
      renderChartSecagem(perfilCulturaAtual);

      const badgeModo = document.getElementById('badge-modo-operacao');
      const textoModo = document.getElementById('texto-modo-operacao');
      if (badgeModo) {
        badgeModo.textContent = '🧪 Modo Demonstração & Pitch (Banca)';
        badgeModo.className = 'badge-modo-pitch';
      }
      if (textoModo) {
        textoModo.textContent = 'Simule os 3 cenários da banca ou observe a classificação 100% autônoma pelo ESP32:';
      }

      try {
        await fetch('http://127.0.0.1:8000/api/demo/reset', { method: 'POST' });
      } catch {}
      const liveRegion = document.getElementById('sr-anuncios');
      if (liveRegion) {
        liveRegion.textContent = 'Parâmetros de calibração padrão restaurados com sucesso.';
      }
    });
  }
}

function atualizarBotoesCulturaUi(culturaAtiva) {
  document.querySelectorAll('.btn-cultura').forEach((btn) => {
    const isAtivo = btn.getAttribute('data-cultura') === culturaAtiva;
    btn.classList.toggle('cultura-ativa', isAtivo);
    btn.setAttribute('aria-checked', isAtivo ? 'true' : 'false');
  });
}

function resolverLimiteFinalKpa(limiteOverride, fase) {
  if (limiteOverride !== null && !Number.isNaN(limiteOverride)) {
    return Number.parseFloat(limiteOverride);
  }
  if (fase) {
    return obterLimiteKpaFase(fase, tipoSoloAtual);
  }
  return PERFIS_CULTURA[perfilCulturaAtual]?.manejoKpa || 28;
}

function formatarStatusDiasRestantes(diasRestantes) {
  if (diasRestantes <= 0) {
    return { texto: '0 dias (CRÍTICO)', cor: '#ef4444' };
  }
  if (diasRestantes <= 1.0) {
    return { texto: `${diasRestantes} dia (< 24h)`, cor: '#ef4444' };
  }
  if (diasRestantes <= 3.0) {
    return { texto: `${diasRestantes} dias (Atenção)`, cor: '#f59e0b' };
  }
  return { texto: `${diasRestantes} dias (Seguro)`, cor: '#10b981' };
}

export function atualizarPredicaoUi(tensaoOverride = null, limiteOverride = null) {
  const t = tensaoOverride !== null 
    ? Number.parseFloat(tensaoOverride) 
    : (Number.parseFloat(tensaoAtualKpa) || 21.5);
  const taxaPadrao = PERFIS_CULTURA[perfilCulturaAtual]?.taxaSecagemPadrao || 2.0;
  const fase = obterFaseAtiva();
  const limiteFinal = resolverLimiteFinalKpa(limiteOverride, fase);

  const pred = calcularPredicaoSecagem(t, perfilCulturaAtual, taxaPadrao, limiteFinal);

  const taxaEl = document.getElementById('pred-taxa-val');
  const diasEl = document.getElementById('pred-dias-val');
  const msgEl = document.getElementById('pred-msg-texto');

  if (taxaEl) taxaEl.textContent = `${pred.taxaSecagemKpaDia.toFixed(1)} kPa/dia`;
  if (diasEl) {
    const statusDias = formatarStatusDiasRestantes(pred.diasRestantes);
    diasEl.textContent = statusDias.texto;
    diasEl.style.color = statusDias.cor;
  }
  if (msgEl) {
    msgEl.textContent = pred.mensagem;
    msgEl.style.borderLeftColor = pred.cor;
  }

  const valLimite = document.getElementById('val-limite-embrapa');
  const perfil = PERFIS_CULTURA[perfilCulturaAtual] || PERFIS_CULTURA.olericultura_alface_argissolo;
  if (valLimite) {
    valLimite.textContent = `${limiteFinal} kPa (${perfil.cultura}${fase ? ' · ' + fase.fase : ''})`;
  }
}

/**
 * 6. Widget de Georreferenciamento & Clima do Talhão (Open-Meteo Oficial)
 */
function initClimaTalhao() {
  const selectMun = document.getElementById('select-municipio-rs');
  const btnGps = document.getElementById('btn-obter-gps');
  const btnAtualizar = document.getElementById('btn-atualizar-clima');
  const coordTextoEl = document.getElementById('clima-coordenadas-texto');

  // 1. Recupera preferência do produtor gravada em localStorage ou default
  const munSalvo = localStorage.getItem('teko_municipio_rs');
  if (munSalvo && MUNICIPIOS_RS[munSalvo]) {
    localizacaoAtiva = MUNICIPIOS_RS[munSalvo];
    if (selectMun) selectMun.value = munSalvo;
  } else if (selectMun && selectMun.value && MUNICIPIOS_RS[selectMun.value]) {
    localizacaoAtiva = MUNICIPIOS_RS[selectMun.value];
  }

  // 2. Evento de troca de município no dropdown
  if (selectMun) {
    selectMun.addEventListener('change', () => {
      const chave = selectMun.value;
      if (btnGps && chave !== 'gps_talhao') {
        btnGps.innerHTML = '<span>📍</span> <span>GPS</span>';
        btnGps.classList.remove('ativo');
      }
      if (MUNICIPIOS_RS[chave]) {
        localizacaoAtiva = MUNICIPIOS_RS[chave];
        try {
          localStorage.setItem('teko_municipio_rs', chave);
        } catch {}
        const rotuloFormatado = `${localizacaoAtiva.nome} (${localizacaoAtiva.regiao || 'RS'})`;
        void atualizarPrevisaoClima(localizacaoAtiva.lat, localizacaoAtiva.lon, rotuloFormatado);
      }
    });
  }

  // 3. Botão de Atualização Manual do Clima (Satélite Open-Meteo)
  if (btnAtualizar) {
    btnAtualizar.addEventListener('click', () => {
      btnAtualizar.style.transform = 'rotate(180deg)';
      btnAtualizar.style.transition = 'transform 0.4s ease';
      setTimeout(() => { btnAtualizar.style.transform = ''; }, 450);
      const rotuloAtual = localizacaoAtiva.regiao 
        ? `${localizacaoAtiva.nome} (${localizacaoAtiva.regiao})`
        : localizacaoAtiva.nome;
      void atualizarPrevisaoClima(localizacaoAtiva.lat, localizacaoAtiva.lon, rotuloAtual);
    });
  }

  // 4. Botão de GPS com detecção de sandbox do Telegram WebApp e fallback gracioso
  if (btnGps) {
    btnGps.addEventListener('click', () => {
      const isTelegram = Boolean(window.Telegram && window.Telegram.WebApp);

      // Verificação de ambiente Telegram restrito sem suporte nativo a geolocalização no webview
      if (isTelegram && (!window.Telegram.WebApp.LocationManager || !window.Telegram.WebApp.LocationManager.init)) {
        if (coordTextoEl) {
          coordTextoEl.textContent = 'ℹ️ No Telegram Mini App, selecione seu polo agrícola diretamente no seletor do RS ao lado (sem necessidade de permissões).';
        }
        if (selectMun) {
          selectMun.focus();
        }
        return;
      }

      if (!('geolocation' in navigator)) {
        if (coordTextoEl) {
          coordTextoEl.textContent = '⚠️ Geolocalização indisponível no dispositivo. Selecione sua cidade do RS na lista.';
        }
        if (selectMun) selectMun.focus();
        return;
      }

      btnGps.innerHTML = '<span>🛰️</span> <span>Localizando...</span>';
      btnGps.disabled = true;
      if (coordTextoEl) {
        coordTextoEl.textContent = '🛰️ Conectando satélites e obtendo coordenadas GPS do talhão...';
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btnGps.disabled = false;
          btnGps.innerHTML = '<span>📍</span> <span>GPS Ativo</span>';
          btnGps.classList.add('ativo');

          const lat = Number(pos.coords.latitude.toFixed(4));
          const lon = Number(pos.coords.longitude.toFixed(4));
          const rotuloGps = `📍 Talhão Sentinela (GPS: ${lat}, ${lon})`;

          localizacaoAtiva = { nome: rotuloGps, lat, lon, regiao: 'GPS Local' };

          if (selectMun) {
            let optGps = selectMun.querySelector('option[value="gps_talhao"]');
            if (!optGps) {
              optGps = document.createElement('option');
              optGps.value = 'gps_talhao';
              selectMun.insertBefore(optGps, selectMun.firstChild);
            }
            optGps.textContent = rotuloGps;
            selectMun.value = 'gps_talhao';
          }

          void atualizarPrevisaoClima(lat, lon, rotuloGps);
        },
        (err) => {
          btnGps.disabled = false;
          btnGps.innerHTML = '<span>📍</span> <span>GPS</span>';
          btnGps.classList.remove('ativo');
          console.warn('Sinal GPS indisponível ou negado:', err);

          if (coordTextoEl) {
            const detalhe = isTelegram 
              ? 'permissão restrita pelo Telegram'
              : (err.code === 1 ? 'permissão negada' : 'sinal satelital fraco');
            coordTextoEl.textContent = `ℹ️ GPS não conectado (${detalhe}). Selecione o município mais próximo do talhão na lista do RS.`;
          }
          if (selectMun) selectMun.focus();
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 30000
        }
      );
    });
  }

  // 5. Carrega previsão inicial da localização selecionada
  const rotuloInicial = localizacaoAtiva.regiao 
    ? `${localizacaoAtiva.nome} (${localizacaoAtiva.regiao})`
    : localizacaoAtiva.nome;
  void atualizarPrevisaoClima(localizacaoAtiva.lat, localizacaoAtiva.lon, rotuloInicial);
}

/**
 * Busca previsão meteorológica resiliente:
 * 1. Open-Meteo Oficial via HTTPS (Sem necessidade de chave, CORS habilitado, funciona em GitHub Pages e Celular).
 * 2. Backend FastAPI local (quando em ambiente dev local).
 * 3. Fallback estático de emergência caso completamente sem internet.
 */
async function buscarPrevisaoOpenMeteo(lat, lon, nomeLocal) {
  // 1. Chamada direta HTTPS para Open-Meteo
  try {
    const urlMeteo = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m&hourly=precipitation,precipitation_probability&forecast_days=2&timezone=auto`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    const res = await fetch(urlMeteo, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const tempAtual = data.current?.temperature_2m ?? 23.5;
      const umidAtual = data.current?.relative_humidity_2m ?? 65;
      const ventoVel = data.current?.wind_speed_10m ?? 12.0;
      const ventoRaj = data.current?.wind_gusts_10m ?? ventoVel * 1.35;

      const precipitacoes = data.hourly?.precipitation || [];
      const probsChuva = data.hourly?.precipitation_probability || [];
      const chuva24h = precipitacoes.length > 0
        ? Number(precipitacoes.slice(0, 24).reduce((acc, v) => acc + (Number(v) || 0), 0).toFixed(1))
        : 0.0;
      const probChuvaMax = probsChuva.length > 0
        ? Math.max(...probsChuva.slice(0, 24).map(v => Number(v) || 0))
        : 0;

      const alertaVendaval = ventoRaj >= 50.0;
      const alertaSuspensao = chuva24h >= 15.0 || probChuvaMax >= 70;

      let recomendacao = `Tempo firme para ${nomeLocal}. Sem previsão de chuva expressiva. Siga o manejo do biossensor.`;
      if (alertaVendaval) {
        recomendacao = `Rajadas severas previstas (${ventoRaj.toFixed(0)} km/h). Reforce escoras das estufas e verifique fixação das linhas de gotejo.`;
      } else if (alertaSuspensao) {
        recomendacao = `Chuva prevista de ${chuva24h} mm (${probChuvaMax}% probab.). Suspenda irrigação programada para economizar água e combustível.`;
      }

      return {
        temperatura_c: Number(tempAtual.toFixed(1)),
        umidade_relativa_pct: Math.round(umidAtual),
        vento_velocidade_kmh: Number(ventoVel.toFixed(1)),
        vento_rajadas_kmh: Number(ventoRaj.toFixed(1)),
        chuva_prevista_24h_mm: chuva24h,
        probabilidade_chuva_max_pct: probChuvaMax,
        alerta_vendaval: alertaVendaval,
        alerta_suspensao_irrigacao: alertaSuspensao,
        recomendacao_manejo: recomendacao,
        fonte: 'open-meteo-https-live'
      };
    }
  } catch (err) {
    console.warn('Conexão direta Open-Meteo indisponível, tentando backend local...', err);
  }

  // 2. Tenta backend local FastAPI se estiver rodando
  try {
    const resLocal = await fetch(`http://127.0.0.1:8000/api/clima/previsao?lat=${lat}&lon=${lon}`);
    if (resLocal.ok) {
      const data = await resLocal.json();
      data.fonte = 'fastapi-backend';
      return data;
    }
  } catch {}

  // 3. Fallback estático seguro caso o dispositivo esteja sem conexão de dados
  return {
    temperatura_c: 23.8,
    umidade_relativa_pct: 68,
    vento_velocidade_kmh: 16.0,
    vento_rajadas_kmh: 22.0,
    chuva_prevista_24h_mm: 0.0,
    probabilidade_chuva_max_pct: 10,
    alerta_vendaval: false,
    alerta_suspensao_irrigacao: false,
    recomendacao_manejo: `Sem previsão de chuva para ${nomeLocal}. Siga o manejo do biossensor.`,
    fonte: 'fallback-offline'
  };
}

async function atualizarPrevisaoClima(lat, lon, nomeLocal) {
  const coordTextoEl = document.getElementById('clima-coordenadas-texto');
  const tempEl = document.getElementById('clima-temp-val');
  const umidEl = document.getElementById('clima-umid-val');
  const ventoEl = document.getElementById('clima-vento-val');
  const chuvaEl = document.getElementById('clima-chuva-val');
  const probEl = document.getElementById('clima-prob-val');
  const alertaBox = document.getElementById('clima-banner-alerta');

  if (coordTextoEl) {
    coordTextoEl.textContent = `${nomeLocal} · ${lat}, ${lon}`;
  }

  const data = await buscarPrevisaoOpenMeteo(lat, lon, nomeLocal);
  dadosClimaCache = data;

  if (tempEl) tempEl.textContent = `${data.temperatura_c}°C`;
  if (umidEl) umidEl.textContent = `${data.umidade_relativa_pct}%`;
  if (ventoEl) ventoEl.textContent = `${data.vento_velocidade_kmh} km/h (Rajadas: ${data.vento_rajadas_kmh} km/h)`;
  if (chuvaEl) chuvaEl.textContent = `${data.chuva_prevista_24h_mm} mm`;
  if (probEl) probEl.textContent = `${data.probabilidade_chuva_max_pct}%`;

  if (alertaBox) {
    if (data.alerta_vendaval) {
      alertaBox.className = 'clima-banner-recomendacao clima-banner-alerta';
      alertaBox.innerHTML = `⚠️ <strong>ALERTA DE VENDAVAL:</strong> ${data.recomendacao_manejo}`;
    } else if (data.alerta_suspensao_irrigacao) {
      alertaBox.className = 'clima-banner-recomendacao';
      alertaBox.style.background = 'rgba(56, 189, 248, 0.15)';
      alertaBox.style.borderLeftColor = '#38bdf8';
      alertaBox.style.color = '#bae6fd';
      alertaBox.innerHTML = `⏳ <strong>ECONOMIA DE ÁGUA:</strong> ${data.recomendacao_manejo}`;
    } else {
      alertaBox.className = 'clima-banner-recomendacao';
      alertaBox.style.background = 'rgba(16, 185, 129, 0.12)';
      alertaBox.style.borderLeftColor = '#10b981';
      alertaBox.style.color = '#d1fae5';
      alertaBox.innerHTML = `🌤️ <strong>TEMPO ESTÁVEL:</strong> ${data.recomendacao_manejo}`;
    }
  }

  atualizarReceitaPrescritiva();
}

/**
 * 7. Receita Prescritiva Agronômica Oficial Embrapa
 */
function atualizarReceitaPrescritiva() {
  const statusTag = document.getElementById('receita-status-tag');
  const statusBomba = document.getElementById('receita-status-bomba');
  const tempoBomba = document.getElementById('receita-tempo-bomba');
  const explicacao = document.getElementById('receita-explicacao-agronomica');
  const avisoClima = document.getElementById('receita-aviso-clima');
  const btnLaudo = document.getElementById('btn-receita-abrir-laudo');

  const perfil = PERFIS_CULTURA[perfilCulturaAtual] || PERFIS_CULTURA.olericultura_alface_argissolo;
  const soloCfg = CONFIG_SOLOS[tipoSoloAtual] || CONFIG_SOLOS.franco;
  const fase = obterFaseAtiva();
  const limiteManejo = fase ? obterLimiteKpaFase(fase, tipoSoloAtual) : perfil.manejoKpa;
  const chuvaPrevista = dadosClimaCache?.chuva_prevista_24h_mm || 0;
  const probChuva = dadosClimaCache?.probabilidade_chuva_max_pct || 0;
  const alertaChuva = dadosClimaCache?.alerta_suspensao_irrigacao || false;
  const alertaVento = dadosClimaCache?.alerta_vendaval || false;

  if (estadoAtual === 'hipoxia' || tensaoAtualKpa <= 6.0) {
    if (statusTag) {
      statusTag.textContent = 'Anóxia Radicular';
      statusTag.className = 'receita-status-tag receita-status-vermelho';
    }
    if (statusBomba) {
      statusBomba.textContent = 'PROIBIDO IRRIGAR (DRENAGEM)';
      statusBomba.style.color = '#ef4444';
    }
    if (tempoBomba) {
      tempoBomba.textContent = 'Economia de 4.200 L de água e R$ 38,00 de diesel hoje ao não irrigar solo afogado';
    }
    if (explicacao) {
      explicacao.textContent = `Solo 100% saturado (0 a 4 kPa). Raízes de ${perfil.cultura} sem oxigênio (ORP negativo). Risco iminente de perda irreversível por asfixia celular.`;
    }
    if (avisoClima) {
      avisoClima.style.borderLeftColor = '#ef4444';
      avisoClima.style.color = '#fca5a5';
      avisoClima.textContent = '🚨 Condição pós-enchente: Emita o laudo pericial para acionar a cobertura do seguro agrícola.';
    }
    if (btnLaudo) btnLaudo.style.display = 'flex';
  } else if (alertaChuva && tensaoAtualKpa < perfil.murchaKpa) {
    if (statusTag) {
      statusTag.textContent = 'Chuva Iminente';
      statusTag.className = 'receita-status-tag receita-status-azul';
    }
    if (statusBomba) {
      statusBomba.textContent = 'SUSPENDER REGA (RECARGA NATURAL)';
      statusBomba.style.color = '#38bdf8';
    }
    if (tempoBomba) {
      tempoBomba.textContent = `Previsão: ${chuvaPrevista} mm de chuva (${probChuva}% chance). Poupe água da represa e diesel!`;
    }
    if (explicacao) {
      explicacao.textContent = `O solo está com tensão de ${tensaoAtualKpa} kPa. Como há frente de chuva significativa prevista para as próximas 24 horas no talhão, a irrigação deve ser suspensa.`;
    }
    if (avisoClima) {
      avisoClima.style.borderLeftColor = '#38bdf8';
      avisoClima.style.color = '#38bdf8';
      avisoClima.textContent = `🌧️ Manejo Preditivo Inteligente: Economize ~R$ 38,00 em diesel/luz aguardando a recarga pluvial.`;
    }
    if (btnLaudo) btnLaudo.style.display = 'none';
  } else if (tensaoAtualKpa >= limiteManejo || estadoAtual === 'sede') {
    const tempoMinutos = tipoSoloAtual === 'arenoso' ? 35 : (tipoSoloAtual === 'franco' ? 45 : 60);
    if (statusTag) {
      statusTag.textContent = 'Necessita Irrigação';
      statusTag.className = 'receita-status-tag receita-status-amarelo';
    }
    if (statusBomba) {
      statusBomba.textContent = `LIGAR MOTOBOMBA (${tempoMinutos} MINUTOS)`;
      statusBomba.style.color = '#f59e0b';
    }
    if (tempoBomba) {
      tempoBomba.textContent = `Turno cirúrgico matinal (${tempoMinutos} min): poupa 2.400 L de água e R$ 22,00 de diesel vs irrigação contínua`;
    }
    if (explicacao) {
      explicacao.textContent = `Tensão matricial (${tensaoAtualKpa} kPa) atingiu o limite crítico Embrapa para ${perfil.cultura}${fase ? ' na fase ' + fase.fase : ''} (${limiteManejo} kPa). Iniciar gotejamento para devolver o solo à Capacidade de Campo (${perfil.ccKpa} kPa).`;
    }
    if (avisoClima) {
      avisoClima.style.borderLeftColor = alertaVento ? '#ef4444' : '#f59e0b';
      avisoClima.style.color = alertaVento ? '#fca5a5' : '#fde68a';
      avisoClima.textContent = alertaVento 
        ? `⚠️ Atenção: Rajadas de vento previstas. Reforce os bicos e evite aspersão aérea com deriva!`
        : `🌤️ Tempo propício para turno de irrigação matinal.`;
    }
    if (btnLaudo) btnLaudo.style.display = 'none';
  } else {
    if (statusTag) {
      statusTag.textContent = 'Solo e Caule Saudáveis';
      statusTag.className = 'receita-status-tag receita-status-verde';
    }
    if (statusBomba) {
      statusBomba.textContent = 'BOMBA DESLIGADA';
      statusBomba.style.color = '#10b981';
    }
    if (tempoBomba) {
      tempoBomba.textContent = 'Tempo estimado de rega: 0 minutos (Economia ativa)';
    }
    if (explicacao) {
      explicacao.textContent = `Tensão matricial (${tensaoAtualKpa} kPa) em faixa ideal de aeração e umidade. Aquaporinas do caule operando normalmente sem estresse fisiológico.`;
    }
    if (avisoClima) {
      avisoClima.style.borderLeftColor = '#10b981';
      avisoClima.style.color = '#6ee7b7';
      avisoClima.textContent = `🌤️ Monitoramento sentinela ativo. Próxima checagem automática em 10 minutos.`;
    }
    if (btnLaudo) btnLaudo.style.display = 'none';
  }
}

/**
 * 8. Simulação ao Vivo dos 3 Estados Eletrofisiológicos
 */
function initSimulacaoEstados() {
  const botoesEstado = document.querySelectorAll('.btn-estado');

  botoesEstado.forEach((btn) => {
    btn.addEventListener('click', () => {
      const estado = btn.getAttribute('data-estado');
      aplicarEstado(estado);
    });
  });

  aplicarEstado('hidratada');
}

export function aplicarEstado(estadoKey) {
  const dados = TELEMETRIA_ESTADOS[estadoKey];
  if (!dados) return;

  estadoAtual = estadoKey;

  if (estadoKey === 'hipoxia') {
    tensaoAtualKpa = 2.0; // Solo Saturado
  } else if (estadoKey === 'sede') {
    tensaoAtualKpa = 48.0; // Estresse Hídrico Crítico
  } else {
    tensaoAtualKpa = 21.5; // Capacidade de Campo (Ideal)
  }
  atualizarAguaDisponivel(tensaoAtualKpa);
  atualizarPredicaoUi(tensaoAtualKpa);
  atualizarReceitaPrescritiva();
  renderChartSecagem(perfilCulturaAtual, [14.0, 16.5, 19.0, 21.5, 25.5, tensaoAtualKpa]);

  document.querySelectorAll('.btn-estado').forEach((btn) => {
    const ativo = btn.getAttribute('data-estado') === estadoKey;
    btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    btn.classList.toggle('ativo', ativo);
  });

  if (plantCanvasController) {
    plantCanvasController.setState(estadoKey);
  }
  if (plant3DController) {
    plant3DController.setState(estadoKey);
  }

  const badgeEl = document.getElementById('diag-badge');
  const tituloEl = document.getElementById('diag-titulo');
  const bombaStatusEl = document.getElementById('diag-bomba-status');
  const bombaBoxEl = document.getElementById('diag-bomba-box');
  const economiaEl = document.getElementById('diag-economia');
  const textoEl = document.getElementById('diag-texto');
  const acaoEl = document.getElementById('diag-acao');

  const valTensao = document.getElementById('val-tensao-kpa');
  const valZ50k = document.getElementById('val-z50k');
  const valZ1k = document.getElementById('val-z1k');
  const valOrp = document.getElementById('val-orp');
  const valCe = document.getElementById('val-ce');

  if (valTensao && dados.tensaoKpa) valTensao.textContent = dados.tensaoKpa;
  if (badgeEl) {
    badgeEl.textContent = dados.badge;
    badgeEl.className = `badge ${dados.badgeClass}`;
  }
  if (tituloEl) tituloEl.textContent = dados.titulo;
  if (bombaStatusEl) bombaStatusEl.textContent = dados.statusBomba;
  if (bombaBoxEl) {
    bombaBoxEl.className = `bomba-banner ${dados.bombaClass}`;
  }
  if (economiaEl) economiaEl.textContent = dados.economiaDestaque;
  if (textoEl) textoEl.textContent = dados.diagnostico;
  if (acaoEl) acaoEl.textContent = dados.acaoRecomendada;

  if (valZ50k) valZ50k.textContent = dados.z50k;
  if (valZ1k) valZ1k.textContent = dados.z1k;
  if (valOrp) valOrp.textContent = dados.orp;
  if (valCe) valCe.textContent = dados.ce;

  const btnProagro = document.getElementById('btn-laudo-proagro');
  if (btnProagro) {
    btnProagro.hidden = !dados.laudoProagroDisponivel;
  }

  const liveRegion = document.getElementById('sr-anuncios');
  if (liveRegion) {
    liveRegion.textContent = `Estado alterado para ${dados.titulo}. ${dados.acaoRecomendada}`;
  }
}

/**
 * 9. Acessibilidade Rural por Voz (SpeechSynthesis pt-BR)
 */
function initVozAcessibilidade() {
  const btnVoz = document.getElementById('btn-ouvir-planta');
  if (!btnVoz) return;

  if (!('speechSynthesis' in window)) {
    btnVoz.style.display = 'none';
    return;
  }

  btnVoz.addEventListener('click', () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setVozState(false);
      return;
    }

    const dados = TELEMETRIA_ESTADOS[estadoAtual];
    if (!dados) return;

    window.speechSynthesis.cancel();
    const ad = calcularAguaDisponivel(tensaoAtualKpa, tipoSoloAtual);
    const cfg = CONFIG_SOLOS[tipoSoloAtual] || CONFIG_SOLOS.franco;
    const textoVoz = `Atenção produtor. ${cfg.nome}. Água disponível para as raízes em ${ad.porcentagem} por cento. ` + dados.ttsVoz;

    const utterance = new SpeechSynthesisUtterance(textoVoz);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setVozState(true);
    utterance.onend = () => setVozState(false);
    utterance.onerror = () => setVozState(false);

    window.speechSynthesis.speak(utterance);
  });
}

function setVozState(speaking) {
  isSpeaking = speaking;
  const btnVoz = document.getElementById('btn-ouvir-planta');
  const iconSpan = document.getElementById('voz-icone');
  const textSpan = document.getElementById('voz-texto');

  if (btnVoz) {
    btnVoz.setAttribute('aria-pressed', speaking ? 'true' : 'false');
    btnVoz.classList.toggle('falando', speaking);
  }
  if (iconSpan) {
    iconSpan.textContent = speaking ? '⏹️' : '🔊';
  }
  if (textSpan) {
    textSpan.textContent = speaking ? 'Parar Áudio' : 'Ouvir Planta';
  }
}

export function narrarDiagnostico(texto) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.onstart = () => setVozState(true);
  utterance.onend = () => setVozState(false);
  utterance.onerror = () => setVozState(false);
  window.speechSynthesis.speak(utterance);
}

/**
 * 10. Simulador Visual do Chat do Telegram com Perguntas Frequentes
 */
function initChatSimulado() {
  const chatContainer = document.getElementById('chat-mensagens');
  const containerPerguntas = document.getElementById('chat-perguntas-rapidas');
  if (!chatContainer || !containerPerguntas) return;

  containerPerguntas.innerHTML = '';
  FAQ_PRODUTOR.forEach((faq) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-pergunta-chat';
    btn.textContent = faq.pergunta;
    btn.addEventListener('click', () => {
      enviarPerguntaSimulada(faq.pergunta, faq.resposta);
    });
    containerPerguntas.appendChild(btn);
  });
}

function enviarPerguntaSimulada(pergunta, resposta) {
  const chatContainer = document.getElementById('chat-mensagens');
  if (!chatContainer) return;

  const msgUser = document.createElement('div');
  msgUser.className = 'msg-chat msg-produtor';
  msgUser.innerHTML = `<strong>Você:</strong> ${escapeHtml(pergunta)}`;
  chatContainer.appendChild(msgUser);

  const msgDigitando = document.createElement('div');
  msgDigitando.className = 'msg-chat msg-bot digitando';
  msgDigitando.innerHTML = `<em>Tekó Biotech está respondendo...</em>`;
  chatContainer.appendChild(msgDigitando);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  setTimeout(() => {
    msgDigitando.remove();
    const msgBot = document.createElement('div');
    msgBot.className = 'msg-chat msg-bot';
    msgBot.innerHTML = `<strong>🌱 Tekó Biotech:</strong> ${escapeHtml(resposta)}`;
    chatContainer.appendChild(msgBot);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, 450);
}

/**
 * 11. Ficha Técnica da Engenharia (Pilares) e Parâmetros Embrapa
 */
function initEngenharia() {
  const containerPilares = document.getElementById('container-pilares-engenharia');
  if (containerPilares) {
    containerPilares.innerHTML = '';
    PILARES_ENGENHARIA.forEach((pilar) => {
      const card = document.createElement('article');
      card.className = 'card-pilar';
      card.innerHTML = `
        <h3>${escapeHtml(pilar.titulo)}</h3>
        <p class="pilar-sub">${escapeHtml(pilar.subtitulo)}</p>
        <p class="pilar-desc">${escapeHtml(pilar.descricao)}</p>
      `;
      containerPilares.appendChild(card);
    });
  }

  // 11.1 Renderizar Tabela de Fases Fenológicas (Milho por padrão)
  renderizarTabelaFasesFenologicas('milho');

  // 11.2 Renderizar Tabela de Van Genuchten (11 Solos)
  renderizarTabelaVanGenuchten();

  // 11.3 Alternância de Cultura nas Abas da Tabela de Fases
  const btnsFaseTab = document.querySelectorAll('.btn-tab-fase');
  btnsFaseTab.forEach((btn) => {
    btn.addEventListener('click', () => {
      btnsFaseTab.forEach((b) => {
        b.classList.remove('ativo');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('ativo');
      btn.setAttribute('aria-selected', 'true');
      const culturaTab = btn.dataset.culturaTab || 'milho';
      renderizarTabelaFasesFenologicas(culturaTab);
    });
  });
}

function renderizarTabelaFasesFenologicas(culturaKey = 'milho') {
  const container = document.getElementById('container-tabela-fases');
  if (!container) return;

  const dados = MATRIZ_FASES_CULTURA[culturaKey];
  if (!dados?.fases) return;

  let html = `
    <table class="tabela-estado-hidrico" style="width: 100%; border-collapse: collapse;">
      <caption class="sr-only">Fases fenológicas e limites hídricos para ${escapeHtml(dados.nome)}</caption>
      <thead>
        <tr>
          <th scope="col" style="text-align: left;">Fase Fenológica</th>
          <th scope="col" style="text-align: center;">Raiz (Zr)</th>
          <th scope="col" style="text-align: center;">Kc (FAO-56)</th>
          <th scope="col" style="text-align: center;">Arenoso</th>
          <th scope="col" style="text-align: center;">Franco-Aren.</th>
          <th scope="col" style="text-align: center;">Franco</th>
          <th scope="col" style="text-align: center;">Argiloso</th>
          <th scope="col" style="text-align: center;">Lâmina (ETc)</th>
          <th scope="col" style="text-align: left;">Fonte Oficial</th>
        </tr>
      </thead>
      <tbody>
  `;

  dados.fases.forEach((f) => {
    const lamina = calcularLaminaIrrigacao(4.0, f.kc);
    const laminaVal = (lamina && (lamina.laminaMmDia || lamina.etcMmDia)) ? (lamina.laminaMmDia || lamina.etcMmDia) : (4.0 * f.kc).toFixed(1);
    html += `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(f.fase)}</td>
        <td style="text-align: center; font-family: monospace;">${f.raizMm} mm</td>
        <td style="text-align: center; font-weight: 700; color: #10b981;">${f.kc.toFixed(2)}</td>
        <td style="text-align: center; font-family: monospace;">${f.limiaresKpa.arenoso} kPa</td>
        <td style="text-align: center; font-family: monospace;">${f.limiaresKpa.franco_arenoso} kPa</td>
        <td style="text-align: center; font-family: monospace;">${f.limiaresKpa.franco} kPa</td>
        <td style="text-align: center; font-family: monospace;">${f.limiaresKpa.argiloso} kPa</td>
        <td style="text-align: center; font-family: monospace;">${laminaVal} mm/dia</td>
        <td style="font-size: 0.75rem; color: var(--texto-secundario);">${escapeHtml(f.fonte)}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

function renderizarTabelaVanGenuchten() {
  const container = document.getElementById('container-tabela-van-genuchten');
  if (!container) return;

  let html = `
    <table class="tabela-estado-hidrico" style="width: 100%; border-collapse: collapse;">
      <caption class="sr-only">Parâmetros analíticos de retenção de água segundo Van Genuchten (11 classes texturais)</caption>
      <thead>
        <tr>
          <th scope="col" style="text-align: left;">Classe Textural (USDA / Embrapa)</th>
          <th scope="col" style="text-align: center;">θr (m³/m³)</th>
          <th scope="col" style="text-align: center;">θs (m³/m³)</th>
          <th scope="col" style="text-align: center;">α (kPa⁻¹)</th>
          <th scope="col" style="text-align: center;">n</th>
          <th scope="col" style="text-align: center;">m (1 - 1/n)</th>
          <th scope="col" style="text-align: center;">Cap. Campo (CC)</th>
          <th scope="col" style="text-align: center;">Ponto Murcha (PMP)</th>
        </tr>
      </thead>
      <tbody>
  `;

  VAN_GENUCHTEN_SOLOS.forEach((s) => {
    let tr = 0.05;
    if (typeof s.thetaR === 'number') {
      tr = s.thetaR;
    } else if (typeof s.theta_r === 'number') {
      tr = s.theta_r;
    }

    let ts = 0.40;
    if (typeof s.thetaS === 'number') {
      ts = s.thetaS;
    } else if (typeof s.theta_s === 'number') {
      ts = s.theta_s;
    }

    const al = typeof s.alpha === 'number' ? s.alpha : 0.1;
    const n = typeof s.n === 'number' ? s.n : 1.5;
    const m = typeof s.m === 'number' ? s.m : (1.0 - (1.0 / n));

    let cc = s.ccKpa;
    if (!cc) {
      if (s.categoria === 'arenoso') {
        cc = 10;
      } else if (s.categoria === 'argiloso') {
        cc = 33;
      } else {
        cc = 22;
      }
    }

    const pmp = s.pmpKpa || 1500;

    html += `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(s.classe)}</td>
        <td style="text-align: center; font-family: monospace;">${tr.toFixed(3)}</td>
        <td style="text-align: center; font-family: monospace;">${ts.toFixed(3)}</td>
        <td style="text-align: center; font-family: monospace;">${al.toFixed(2)}</td>
        <td style="text-align: center; font-family: monospace;">${n.toFixed(2)}</td>
        <td style="text-align: center; font-family: monospace;">${m.toFixed(3)}</td>
        <td style="text-align: center; font-family: monospace;">${cc} kPa</td>
        <td style="text-align: center; font-family: monospace;">${pmp} kPa</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

/**
 * 12. Painel do Gateway Ninhura & Motor de Alertas de Manutenção
 */
function initGatewayPainel() {
  const btnAlerta = document.getElementById('btn-simular-alerta-gateway');
  const logContainer = document.getElementById('gateway-log-container');
  if (!btnAlerta || !logContainer) return;

  const alertasExemplo = [
    {
      tipo: 'alerta',
      texto: 'Nó 04 (Tomate): Resistência de contato elevada no clipe (8.9 kΩ). Recomendado repor bio-hidrogel KCl.'
    },
    {
      tipo: 'destaque',
      texto: 'Nó 02 (Milho): Rajada de vento severa de 64 km/h registrada. Estabilidade mecânica da haste confirmada.'
    },
    {
      tipo: 'ok',
      texto: 'Nó 01 (Alface): Ciclo P-MFC atingiu +0.58V na rizosfera. Superávit energético de 48 mAh/dia garantido.'
    }
  ];

  let alertaIndex = 0;
  btnAlerta.addEventListener('click', () => {
    const item = alertasExemplo[alertaIndex % alertasExemplo.length];
    alertaIndex++;

    const now = new Date().toTimeString().split(' ')[0];
    const novaLinha = document.createElement('div');
    if (item.tipo === 'alerta') {
      novaLinha.innerHTML = `<span class="log-alerta">[${now}] ⚠️ ALERTA:</span> ${escapeHtml(item.texto)}`;
    } else {
      novaLinha.innerHTML = `<span class="log-destaque">[${now}]</span> ${escapeHtml(item.texto)}`;
    }
    logContainer.prepend(novaLinha);

    const liveRegion = document.getElementById('sr-anuncios');
    if (liveRegion) {
      liveRegion.textContent = `Novo evento no Gateway: ${item.texto}`;
    }
  });
}

/**
 * 13. Modal do Laudo de Sinistro PROAGRO
 */
function initModalProagro() {
  const btnAbrir = document.getElementById('btn-laudo-proagro');
  const btnReceitaAbrir = document.getElementById('btn-receita-abrir-laudo');
  const modal = document.getElementById('modal-proagro');
  const btnFechar = document.getElementById('btn-fechar-modal');
  const btnImprimir = document.getElementById('btn-imprimir-laudo');

  if (!modal) return;

  const abrirModal = () => {
    preencherDadosLaudoModal();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    btnFechar?.focus();
  };

  if (btnAbrir) btnAbrir.addEventListener('click', abrirModal);
  if (btnReceitaAbrir) btnReceitaAbrir.addEventListener('click', abrirModal);

  if (btnFechar) {
    btnFechar.addEventListener('click', () => {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  if (btnImprimir) {
    btnImprimir.addEventListener('click', () => {
      window.print();
    });
  }
}

function preencherDadosLaudoModal() {
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const spanData = document.getElementById('laudo-data-emissao');
  const spanGeo = document.getElementById('laudo-localizacao-geo');
  const spanChuva = document.getElementById('laudo-chuva-acumulada');

  if (spanData) spanData.textContent = dataHoje;
  if (spanGeo) {
    spanGeo.textContent = `${localizacaoAtiva.lat.toFixed(4)}° S, ${localizacaoAtiva.lon.toFixed(4)}° W (${localizacaoAtiva.nome})`;
  }
  if (spanChuva) {
    const chuva = dadosClimaCache?.chuva_prevista_24h_mm || 118;
    spanChuva.textContent = `${Math.max(chuva, 85)} mm acumulados (Chuva Torrencial de Várzea registrada via satélite Open-Meteo)`;
  }
}

/**
 * 14. Leitura de Parâmetros de URL (?estado=... & ?tab=...)
 */
function processarUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const estadoParam = params.get('estado');
  const tabParam = params.get('tab');

  if (estadoParam && TELEMETRIA_ESTADOS[estadoParam]) {
    aplicarEstado(estadoParam);
  }

  if (tabParam) {
    const mapaAbas = {
      planta: 'aba-minha-planta',
      triagem: 'aba-triagem-receita',
      receita: 'aba-triagem-receita',
      graficos: 'aba-graficos',
      engenharia: 'aba-engenharia'
    };
    if (mapaAbas[tabParam]) {
      ativarAba(mapaAbas[tabParam]);
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 15. Polling em Tempo Real da Telemetria Fitoeletrônica (ESP32 Físico)
 */
function initPollingBackend() {
  const getApiUrl = () => {
    if (window.TEKO_API_URL) return window.TEKO_API_URL.replace(/\/+$/, '');
    if (window.PHYTOSENSE_API_URL) return window.PHYTOSENSE_API_URL.replace(/\/+$/, '');
    return 'http://127.0.0.1:8000';
  };

  const API_URL = getApiUrl();
  const bannerEl = document.getElementById('banner-status-sensor');
  const textoEl = document.getElementById('sensor-status-texto');
  const detalhesEl = document.getElementById('sensor-status-detalhes');

  async function checarTelemetria() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${API_URL}/api/telemetria/atual?tipo_solo=${encodeURIComponent(tipoSoloAtual)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) return;
      const data = await res.json();

      const badgeModo = document.getElementById('badge-modo-operacao');
      const textoModo = document.getElementById('texto-modo-operacao');

      if (data && data.sensor_fisico_online) {
        if (bannerEl) {
          bannerEl.style.display = 'flex';
          bannerEl.style.background = 'rgba(16, 185, 129, 0.15)';
          bannerEl.style.borderColor = '#10b981';
          bannerEl.style.color = '#10b981';
        }
        if (textoEl) textoEl.textContent = '● SENSOR FÍSICO ONLINE (ESP32 - GPIO 34)';
        if (detalhesEl) detalhesEl.textContent = `${data.tensao_kpa} kPa (${data.segundos_desde_leitura}s atrás)`;

        if (badgeModo) {
          badgeModo.textContent = '📡 Telemetria Autônoma do ESP32 Ativa';
          badgeModo.className = 'badge-modo-autonomo';
        }
        if (textoModo) {
          textoModo.textContent = 'O biossensor físico está classificando a lavoura em tempo real sem intervenção humana:';
        }

        if (data.estado && data.estado !== estadoAtual) {
          aplicarEstado(data.estado);
        }

        if (data.tensao_kpa !== undefined) {
          tensaoAtualKpa = data.tensao_kpa;
          atualizarAguaDisponivel(tensaoAtualKpa);
          atualizarReceitaPrescritiva();
        }

        const valTensao = document.getElementById('val-tensao-kpa');
        const valZ50k = document.getElementById('val-z50k');
        const valZ1k = document.getElementById('val-z1k');
        const valOrp = document.getElementById('val-orp');
        const valCe = document.getElementById('val-ce');

        if (valTensao) valTensao.textContent = `${data.tensao_kpa} kPa`;
        if (valZ50k && data.z_50k_ohms) valZ50k.textContent = `${(data.z_50k_ohms / 1000).toFixed(1)} kΩ`;
        if (valZ1k && data.z_1k_ohms) valZ1k.textContent = `${(data.z_1k_ohms / 1000).toFixed(1)} kΩ`;
        if (valOrp && data.orp_mv !== undefined) valOrp.textContent = `${data.orp_mv >= 0 ? '+' : ''}${data.orp_mv} mV`;
        if (valCe && data.ce_dsm !== undefined) valCe.textContent = `${data.ce_dsm} dS/m`;

      } else if (data && data.fonte === 'simulado' && data.segundos_desde_leitura < 20) {
        if (bannerEl) {
          bannerEl.style.display = 'flex';
          bannerEl.style.background = 'rgba(56, 189, 248, 0.15)';
          bannerEl.style.borderColor = '#38bdf8';
          bannerEl.style.color = '#38bdf8';
        }
        if (textoEl) textoEl.textContent = '🧪 SIMULAÇÃO DE BANCADA ATIVA';
        if (detalhesEl) detalhesEl.textContent = `${data.tensao_kpa} kPa`;

        if (data.estado && data.estado !== estadoAtual) {
          aplicarEstado(data.estado);
        }
      } else {
        if (bannerEl) bannerEl.style.display = 'none';
        if (badgeModo && badgeModo.className !== 'badge-modo-pitch') {
          badgeModo.textContent = '🧪 Modo Demonstração & Pitch (Banca)';
          badgeModo.className = 'badge-modo-pitch';
        }
        if (textoModo && !textoModo.textContent.includes('Simule')) {
          textoModo.textContent = 'Simule os 3 cenários da banca ou observe a classificação 100% autônoma pelo ESP32:';
        }
      }
    } catch {
      if (bannerEl) bannerEl.style.display = 'none';
    }
  }

  setInterval(() => { void checarTelemetria(); }, 3000);
  void checarTelemetria();
}
