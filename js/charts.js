/**
 * PhytoSense RS — Gráficos Interativos e Simulador de Economia
 * Hackathon das Engenharias UERGS 2026
 * 1. Divergência Dia 6 (Saúde no Caule vs. Sensor de Solo)
 * 2. Comparativo de Consumo Energético Diário (mAh/dia)
 * 3. Simulador de Hectares e Economia na Irrigação
 */

import { DADOS_GRAFICO_DIVERGENCIA, DADOS_GRAFICO_ENERGIA, PERFIS_CULTURA } from './content.js?v=7';

let chartDivergenciaInstance = null;
let chartEnergiaInstance = null;
let chartSecagemInstance = null;

export function initCharts() {
  renderChartDivergencia();
  renderChartEnergia();
  renderChartSecagem();
  initHectaresSimulator();
}

/**
 * Gráfico 1: Divergência Crítica de Enchente (Linha)
 */
function renderChartDivergencia() {
  const canvas = document.getElementById('canvas-grafico-divergencia');
  if (!canvas) return;

  if (window.Chart) {
    if (chartDivergenciaInstance) {
      chartDivergenciaInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    chartDivergenciaInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Dia 1', 'Dia 2', 'Dia 3', 'Dia 4', 'Dia 5', 'Dia 6 (Enchente)', 'Dia 7'],
        datasets: [
          {
            label: '🌱 PhytoSense (Caule Real %)',
            data: DADOS_GRAFICO_DIVERGENCIA.saudeCaule,
            borderColor: '#ff6b00',
            backgroundColor: 'rgba(255, 107, 0, 0.15)',
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#ff6b00',
            pointRadius: 5
          },
          {
            label: '🪵 Sensor Comum de Solo (%)',
            data: DADOS_GRAFICO_DIVERGENCIA.sensorSolo,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.05)',
            borderWidth: 2,
            borderDash: [5, 4],
            fill: false,
            tension: 0.2,
            pointBackgroundColor: '#38bdf8',
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#ffffff', font: { size: 11, family: 'sans-serif' } }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1'
          }
        },
        scales: {
          y: {
            min: 0,
            max: 110,
            ticks: {
              color: '#94a3b8',
              callback: (v) => `${v}%`
            },
            grid: { color: 'rgba(255, 255, 255, 0.08)' }
          },
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  } else {
    // Fallback Canvas Nativo em caso de offline/sem CDN
    drawNativeDivergenceChart(canvas);
  }
}

/**
 * Gráfico 2: Comparativo Logarítmico de Consumo Energético
 */
function renderChartEnergia() {
  const canvas = document.getElementById('canvas-grafico-energia');
  if (!canvas) return;

  if (window.Chart) {
    if (chartEnergiaInstance) {
      chartEnergiaInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    chartEnergiaInstance = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['ESP32 Direto', 'PhytoSense RS', 'Geração P-MFC'],
        datasets: [{
          label: 'Consumo / Geração Diária (mAh/dia)',
          data: DADOS_GRAFICO_ENERGIA.consumo,
          backgroundColor: DADOS_GRAFICO_ENERGIA.cores,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'logarithmic',
            ticks: {
              color: '#94a3b8',
              callback: (v) => `${v} mAh`
            },
            grid: { color: 'rgba(255, 255, 255, 0.08)' }
          },
          x: {
            ticks: { color: '#ffffff', font: { size: 10 } },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.raw} mAh/dia`
            }
          }
        }
      }
    });
  } else {
    drawNativeEnergyChart(canvas);
  }
}

/**
 * Fallback nativo do Gráfico de Divergência
 */
function drawNativeDivergenceChart(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 320;
  const h = rect.height || 180;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  const padL = 40;
  const padR = 15;
  const padT = 20;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  // Eixos e grade
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(padL, padT, plotW, plotH);

  const dataCaule = DADOS_GRAFICO_DIVERGENCIA.saudeCaule;
  const dataSolo = DADOS_GRAFICO_DIVERGENCIA.sensorSolo;
  const n = dataCaule.length;

  // Linha do solo
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = padL + (i / (n - 1)) * plotW;
    const y = padT + plotH - (dataSolo[i] / 100) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Linha do caule
  ctx.strokeStyle = '#ff6b00';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = padL + (i / (n - 1)) * plotW;
    const y = padT + plotH - (dataCaule[i] / 100) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Destaque Dia 6
  const dia6X = padL + (5 / (n - 1)) * plotW;
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('⚡ Dia 6: Enchente', dia6X - 35, padT + 12);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('Solo: 100%', dia6X - 25, padT + 26);
  ctx.fillStyle = '#ff6b00';
  ctx.fillText('Planta: 25%', dia6X - 25, padT + 38);
}

/**
 * Fallback nativo do Gráfico de Energia
 */
function drawNativeEnergyChart(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 320;
  const h = rect.height || 140;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  const bars = [
    { label: 'ESP32 Direto', val: 1800, color: '#ef4444', text: '1.800 mAh/d' },
    { label: 'Deep Sleep', val: 14, color: '#10b981', text: '14 mAh/d' },
    { label: 'Geração P-MFC', val: 45, color: '#38bdf8', text: '45 mAh/d' }
  ];

  const maxVal = 1800;
  const barH = 22;
  const startY = 18;
  const gap = 34;

  bars.forEach((b, i) => {
    const y = startY + i * gap;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillText(b.label, 12, y);

    const logW = Math.max(12, (Math.log10(b.val) / Math.log10(maxVal)) * (w - 140));
    ctx.fillStyle = b.color;
    ctx.fillRect(100, y - 10, logW, barH - 8);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(b.text, 108 + logW, y);
  });
}

/**
 * 3. Simulador de Hectares e Economia
 */
export function initHectaresSimulator() {
  const slider = document.getElementById('slider-hectares');
  const spanHectares = document.getElementById('val-hectares');
  const spanSensores = document.getElementById('calc-sensores');
  const spanLitros = document.getElementById('calc-litros');
  const spanReais = document.getElementById('calc-reais');
  const spanDiesel = document.getElementById('calc-diesel');

  if (!slider) return;

  function atualizarCalculos() {
    const ha = parseFloat(slider.value) || 1;
    if (spanHectares) spanHectares.textContent = ha.toFixed(0);

    const sensores = Math.round(ha);
    const litrosMes = ha * 4200 * 8; // 8 dias de bomba desligada por mês
    const reaisMes = ha * 38.0 * 8;
    const dieselLitros = Math.round(reaisMes / 6.20); // Média diesel agrícola RS

    if (spanSensores) spanSensores.textContent = `${sensores} Sentinela${sensores > 1 ? 's' : ''}`;
    if (spanLitros) spanLitros.textContent = `${litrosMes.toLocaleString('pt-BR')} L/mês`;
    if (spanReais) spanReais.textContent = `R$ ${reaisMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (spanDiesel) spanDiesel.textContent = `~${dieselLitros} litros de diesel`;
  }

  slider.addEventListener('input', atualizarCalculos);
  atualizarCalculos();
}

/**
 * 4. Gráfico 3: Taxa de Secagem & Limite Embrapa (7 Dias)
 */
export function renderChartSecagem(idPerfil = 'olericultura_alface_argissolo', dadosCustom = null) {
  const canvas = document.getElementById('canvas-grafico-secagem');
  if (!canvas) return;

  const perfil = PERFIS_CULTURA[idPerfil] || PERFIS_CULTURA.olericultura_alface_argissolo;
  const spanLimite = document.getElementById('grafico-limite-embrapa-val');
  if (spanLimite) spanLimite.textContent = `${perfil.manejoKpa} kPa (${perfil.cultura})`;

  const labels = ['D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Hoje'];
  let serieTensao = dadosCustom || (idPerfil.includes('alface')
    ? [14.0, 16.5, 19.0, 21.5, 23.5, 25.5]
    : [22.0, 24.0, 26.5, 28.0, 30.0, 32.0]);

  const serieLimite = labels.map(() => perfil.manejoKpa);
  const serieAlerta = labels.map(() => perfil.alertaKpa);

  if (window.Chart) {
    if (chartSecagemInstance) {
      chartSecagemInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    chartSecagemInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `🌱 Tensão no Solo (${perfil.cultura} - kPa)`,
            data: serieTensao,
            borderColor: '#ff6b00',
            backgroundColor: 'rgba(255, 107, 0, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#ff6b00',
            pointRadius: 5
          },
          {
            label: `🚨 Limite Crítico Embrapa (${perfil.manejoKpa} kPa)`,
            data: serieLimite,
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            pointRadius: 0
          },
          {
            label: `⚠️ Alerta Atenção (${perfil.alertaKpa} kPa)`,
            data: serieAlerta,
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#ffffff', font: { size: 10 } }
          },
          tooltip: {
            backgroundColor: '#18181b',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} kPa`
            }
          }
        },
        scales: {
          y: {
            min: 5,
            max: Math.max(60, perfil.manejoKpa + 15),
            ticks: {
              color: '#94a3b8',
              callback: (v) => `${v} kPa`
            },
            grid: { color: 'rgba(255, 255, 255, 0.08)' }
          },
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  } else {
    drawNativeSecagemChart(canvas, serieTensao, perfil);
  }
}

function drawNativeSecagemChart(canvas, serieTensao, perfil) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth || 320;
  const h = 200;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '11px sans-serif';
  ctx.fillText(`Tendência de Secagem: ${perfil.cultura} (Limite: ${perfil.manejoKpa} kPa)`, 14, 20);
}
