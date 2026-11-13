/**
 * PhytoSense RS — Aplicação Mobile / Telegram Mini App
 * Hackathon das Engenharias UERGS 2026
 */

import { initPlantCanvas } from './canvas_planta.js?v=3';
import { initCharts } from './charts.js?v=3';
import { TELEMETRIA_ESTADOS, FAQ_PRODUTOR, PILARES_ENGENHARIA } from './content.js?v=3';
import { iniciarTelegram } from './telegram.js?v=3';

let plantCanvasController = null;
let estadoAtual = 'hidratada';
let isSpeaking = false;

document.addEventListener('DOMContentLoaded', () => {
  iniciarTelegram();
  initServiceWorker();
  initTabs();
  initCanvas();
  initSimulacaoEstados();
  initVozAcessibilidade();
  initChatSimulado();
  initEngenharia();
  initModalProagro();
  initCharts();
  processarUrlParams();
  initPollingBackend();
});

/**
 * 1. Gerenciamento do Service Worker
 */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    } else {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
}

/**
 * 2. Navegação entre as 3 Abas Principais
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

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

  // Se ativou gráficos, garante resize dos canvases
  if (targetId === 'aba-graficos') {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }
}

/**
 * 3. Inicialização do Canvas Interativo da Planta Sentinela
 */
function initCanvas() {
  const canvasEl = document.getElementById('canvas-planta');
  if (canvasEl) {
    plantCanvasController = initPlantCanvas(canvasEl);
  }
}

/**
 * 4. Simulação ao Vivo dos 3 Estados Eletrofisiológicos
 */
function initSimulacaoEstados() {
  const botoesEstado = document.querySelectorAll('.btn-estado');

  botoesEstado.forEach((btn) => {
    btn.addEventListener('click', () => {
      const estado = btn.getAttribute('data-estado');
      aplicarEstado(estado);
    });
  });

  // Aplica estado inicial hidratada
  aplicarEstado('hidratada');
}

export function aplicarEstado(estadoKey) {
  const dados = TELEMETRIA_ESTADOS[estadoKey];
  if (!dados) return;

  estadoAtual = estadoKey;

  // Atualiza botões seletores
  document.querySelectorAll('.btn-estado').forEach((btn) => {
    const ativo = btn.getAttribute('data-estado') === estadoKey;
    btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    btn.classList.toggle('ativo', ativo);
  });

  // Atualiza animação no canvas
  if (plantCanvasController) {
    plantCanvasController.setState(estadoKey);
  }

  // Atualiza painel de diagnóstico
  const badgeEl = document.getElementById('diag-badge');
  const tituloEl = document.getElementById('diag-titulo');
  const bombaStatusEl = document.getElementById('diag-bomba-status');
  const bombaBoxEl = document.getElementById('diag-bomba-box');
  const economiaEl = document.getElementById('diag-economia');
  const textoEl = document.getElementById('diag-texto');
  const acaoEl = document.getElementById('diag-acao');

  // Parâmetros eletroquímicos no card
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

  // Mostra ou oculta botão PROAGRO
  const btnProagro = document.getElementById('btn-laudo-proagro');
  if (btnProagro) {
    btnProagro.hidden = !dados.laudoProagroDisponivel;
  }

  // Notifica leitor de tela
  const liveRegion = document.getElementById('sr-anuncios');
  if (liveRegion) {
    liveRegion.textContent = `Estado alterado para ${dados.titulo}. ${dados.acaoRecomendada}`;
  }
}

/**
 * 5. Acessibilidade Rural por Voz (SpeechSynthesis pt-BR)
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
    const utterance = new SpeechSynthesisUtterance(dados.ttsVoz);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95; // Levemente cadenciado para fácil compreensão
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

/**
 * 6. Simulador Visual do Chat do Telegram com Perguntas Preditivas
 */
function initChatSimulado() {
  const chatContainer = document.getElementById('chat-mensagens');
  const containerPerguntas = document.getElementById('chat-perguntas-rapidas');
  if (!chatContainer || !containerPerguntas) return;

  containerPerguntas.innerHTML = '';
  FAQ_PRODUTOR.forEach((faq, index) => {
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

  // Mensagem do Produtor
  const msgUser = document.createElement('div');
  msgUser.className = 'msg-chat msg-produtor';
  msgUser.innerHTML = `<strong>Você:</strong> ${escapeHtml(pergunta)}`;
  chatContainer.appendChild(msgUser);

  // Digitando...
  const msgDigitando = document.createElement('div');
  msgDigitando.className = 'msg-chat msg-bot digitando';
  msgDigitando.innerHTML = `<em>PhytoSense RS está respondendo...</em>`;
  chatContainer.appendChild(msgDigitando);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  setTimeout(() => {
    msgDigitando.remove();
    const msgBot = document.createElement('div');
    msgBot.className = 'msg-chat msg-bot';
    msgBot.innerHTML = `<strong>🌱 PhytoSense RS:</strong> ${escapeHtml(resposta)}`;
    chatContainer.appendChild(msgBot);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, 450);
}

/**
 * 7. Ficha Técnica da Engenharia
 */
function initEngenharia() {
  const containerPilares = document.getElementById('container-pilares-engenharia');
  if (!containerPilares) return;

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

/**
 * 8. Modal do Laudo de Sinistro PROAGRO
 */
function initModalProagro() {
  const btnAbrir = document.getElementById('btn-laudo-proagro');
  const modal = document.getElementById('modal-proagro');
  const btnFechar = document.getElementById('btn-fechar-modal');
  const btnImprimir = document.getElementById('btn-imprimir-laudo');

  if (!modal) return;

  if (btnAbrir) {
    btnAbrir.addEventListener('click', () => {
      preencherDadosLaudoModal();
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      btnFechar?.focus();
    });
  }

  if (btnFechar) {
    btnFechar.addEventListener('click', () => {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      btnAbrir?.focus();
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
  if (spanData) spanData.textContent = dataHoje;
}

/**
 * 9. Leitura de Parâmetros de URL (?estado=... & ?tab=...)
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
 * 10. Polling em Tempo Real da Telemetria Fitoeletrônica (ESP32 Físico)
 */
function initPollingBackend() {
  const getApiUrl = () => {
    if (window.PHYTOSENSE_API_URL) return window.PHYTOSENSE_API_URL.replace(/\/+$/, '');
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      return 'http://127.0.0.1:8000';
    }
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
      const res = await fetch(`${API_URL}/api/telemetria/atual`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) return;
      const data = await res.json();

      if (data && data.sensor_fisico_online) {
        if (bannerEl) {
          bannerEl.style.display = 'flex';
          bannerEl.style.background = 'rgba(16, 185, 129, 0.15)';
          bannerEl.style.borderColor = '#10b981';
          bannerEl.style.color = '#10b981';
        }
        if (textoEl) textoEl.textContent = '● SENSOR FÍSICO ONLINE (ESP32 - GPIO 34)';
        if (detalhesEl) detalhesEl.textContent = `${data.tensao_kpa} kPa (${data.segundos_desde_leitura}s atrás)`;

        // 1. Sincroniza estado estrutural primeiro (canvas, botões, semáforo)
        if (data.estado && data.estado !== estadoAtual) {
          aplicarEstado(data.estado);
        }

        // 2. Sobrescreve com as leituras analógicas exatas do ESP32 físico
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

        // Sincroniza estado simulado no canvas e UI
        if (data.estado && data.estado !== estadoAtual) {
          aplicarEstado(data.estado);
        }
      } else {
        if (bannerEl) bannerEl.style.display = 'none';
      }
    } catch {
      // Backend offline: modo contingência silencioso
      if (bannerEl) bannerEl.style.display = 'none';
    }
  }

  // Polling a cada 3 segundos
  setInterval(checarTelemetria, 3000);
  checarTelemetria();
}
