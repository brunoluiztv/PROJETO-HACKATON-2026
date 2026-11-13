/**
 * Tekó Biotech — Renderização Interativa da Planta Sentinela
 * Desenha o caule verde, o clipe laranja biocompatível (50kHz / 1kHz),
 * a rizosfera com a haste basal P-MFC (ORP) e a onda senoidal bioelétrica.
 */

let animationFrameId = null;
let currentPhase = 0;
let currentState = 'hidratada';

const STATE_CONFIG = {
  hidratada: {
    color: '#10b981',       // Verde vigoroso
    waveColor: '#10b981',
    waveFreq: 0.08,
    waveAmp: 18,
    waveSpeed: 0.06,
    label: 'Seiva Vigorosa (1.4 kΩ)',
    clipColor: '#ff6b00',
    rootStatus: 'Oxigenada (+310 mV)',
    rootColor: '#10b981'
  },
  sede: {
    color: '#f59e0b',       // Amarelo alerta
    waveColor: '#f59e0b',
    waveFreq: 0.04,
    waveAmp: 8,
    waveSpeed: 0.03,
    label: 'Fluxo Reduzido / Sede (4.8 kΩ)',
    clipColor: '#ff6b00',
    rootStatus: 'Estresse Hídrico (+420 mV)',
    rootColor: '#f59e0b'
  },
  hipoxia: {
    color: '#ef4444',       // Vermelho perigo
    waveColor: '#ef4444',
    waveFreq: 0.02,
    waveAmp: 4,
    waveSpeed: 0.015,
    label: 'Hipóxia Radicular / Asfixia (-140 mV)',
    clipColor: '#ff6b00',
    rootStatus: 'Solo Saturado / Anóxia',
    rootColor: '#ef4444'
  }
};

export function setPlantState(state) {
  if (STATE_CONFIG[state]) {
    currentState = state;
  }
}

export function initPlantCanvas(canvasElement) {
  if (!canvasElement) return null;
  const ctx = canvasElement.getContext('2d');
  if (!ctx) return null;

  function resize() {
    const rect = canvasElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width || 360);
    const height = Math.floor(rect.height || 340);

    canvasElement.width = width * dpr;
    canvasElement.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);

  function draw() {
    const rect = canvasElement.getBoundingClientRect();
    const w = rect.width || 360;
    const h = rect.height || 340;
    const cfg = STATE_CONFIG[currentState] || STATE_CONFIG.hidratada;

    ctx.clearRect(0, 0, w, h);

    // 1. Fundo do solo (área inferior da rizosfera)
    const groundY = h * 0.62;
    const soilGrad = ctx.createLinearGradient(0, groundY, 0, h);
    if (currentState === 'hipoxia') {
      soilGrad.addColorStop(0, '#2d2218');
      soilGrad.addColorStop(0.35, '#1c2833'); // aspecto alagado/lodo
      soilGrad.addColorStop(1, '#08111a');
    } else {
      soilGrad.addColorStop(0, '#2b1d0c');
      soilGrad.addColorStop(1, '#120d06');
    }
    ctx.fillStyle = soilGrad;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Linha de divisão do solo
    ctx.strokeStyle = currentState === 'hipoxia' ? '#38bdf8' : '#785428';
    ctx.lineWidth = currentState === 'hipoxia' ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    if (currentState === 'hipoxia') {
      // Indicador visual de lâmina d'água / enchente
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fillRect(0, groundY - 18, w, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('🌊 Lâmina de Enchente (Solo Saturado 100% · Hipóxia)', 14, groundY - 5);
    }

    // 2. Raízes e Haste Basal P-MFC
    const centerX = Math.min(150, Math.floor(w * 0.32));

    // Raiz principal
    ctx.strokeStyle = cfg.rootColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, groundY);
    ctx.quadraticCurveTo(centerX - 10, groundY + 40, centerX - 22, h - 35);
    ctx.stroke();

    // Raízes secundárias
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(centerX, groundY + 20);
    ctx.quadraticCurveTo(centerX + 28, groundY + 45, centerX + 40, groundY + 70);
    ctx.moveTo(centerX - 12, groundY + 35);
    ctx.quadraticCurveTo(centerX - 42, groundY + 58, centerX - 50, groundY + 80);
    ctx.stroke();

    // Haste Basal P-MFC (Eletrodo ORP / Célula Microbiana)
    const probeX = centerX + 42;
    const probeTopY = groundY - 12;
    const probeBottomY = h - 40;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(probeX, probeTopY);
    ctx.lineTo(probeX, probeBottomY);
    ctx.stroke();

    // Ponta coletora microbiana (feltro de carbono Geobacter)
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(probeX, probeBottomY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Badge de informação da Haste P-MFC (Com margem e fundo translúcido para evitar corte)
    const pMfcLabelX = probeX + 12;
    const pMfcLabelY = probeBottomY - 14;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(pMfcLabelX - 4, pMfcLabelY - 10, 150, 28, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.stroke();
    }
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('⚡ Haste P-MFC (Geobacter)', pMfcLabelX, pMfcLabelY);
    ctx.fillStyle = cfg.rootColor;
    ctx.fillText(cfg.rootStatus, pMfcLabelX, pMfcLabelY + 12);

    // 3. Caule da Planta
    const stemTopY = 44;
    ctx.strokeStyle = currentState === 'sede' ? '#b45309' : '#15803d';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, groundY);
    ctx.quadraticCurveTo(centerX - 6, (groundY + stemTopY) / 2, centerX + 2, stemTopY);
    ctx.stroke();

    // Folhas no topo
    ctx.fillStyle = currentState === 'sede' ? '#d97706' : '#22c55e';
    // Folha esquerda
    ctx.beginPath();
    ctx.moveTo(centerX, stemTopY + 16);
    ctx.quadraticCurveTo(centerX - 50, stemTopY - 6, centerX - 44, stemTopY + 24);
    ctx.quadraticCurveTo(centerX - 22, stemTopY + 28, centerX, stemTopY + 16);
    ctx.fill();

    // Folha direita
    ctx.beginPath();
    ctx.moveTo(centerX, stemTopY + 8);
    ctx.quadraticCurveTo(centerX + 52, stemTopY - 14, centerX + 48, stemTopY + 18);
    ctx.quadraticCurveTo(centerX + 22, stemTopY + 22, centerX, stemTopY + 8);
    ctx.fill();

    // 4. Clipe de Caule Biocompatível Laranja (#ff6b00)
    const clipY = groundY * 0.48;
    const clipX = centerX - 16;
    const clipW = 34;
    const clipH = 20;

    // Hidrogel condutivo macio (ágar + glicerol + KCl)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(clipX - 2, clipY - 2, clipW + 4, clipH + 4);

    // Corpo do clipe plástico laranja
    ctx.fillStyle = cfg.clipColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(clipX, clipY, clipW, clipH, 4);
    } else {
      ctx.rect(clipX, clipY, clipW, clipH);
    }
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eletrodos de grafite
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(clipX + 6, clipY + 4, 3, clipH - 8);
    ctx.fillRect(clipX + clipW - 9, clipY + 4, 3, clipH - 8);

    // Fio até o microcontrolador ESP32
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(clipX, clipY + clipH / 2);
    ctx.lineTo(w * 0.08, clipY + clipH / 2);
    ctx.lineTo(w * 0.08, 48);
    ctx.stroke();
    ctx.setLineDash([]);

    // Caixa do ESP32-C3 IP68 (Canto superior esquerdo)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(w * 0.03, 20, 68, 32);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w * 0.03, 20, 68, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('ESP32-C3', w * 0.03 + 8, 35);
    ctx.fillStyle = '#10b981';
    ctx.font = '8px "Segoe UI", sans-serif';
    ctx.fillText('IP68 · 10µA', w * 0.03 + 8, 46);

    // Rótulo do Clipe (Com caixa protetora e posicionada logo abaixo do clipe)
    const clipLabelX = clipX + clipW + 8;
    const clipLabelY = clipY;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(clipLabelX - 4, clipLabelY - 2, 120, 32, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.4)';
      ctx.stroke();
    }
    ctx.fillStyle = '#ff6b00';
    ctx.font = 'bold 9.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Clipe (1k / 50 kHz)', clipLabelX, clipLabelY + 11);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '8.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Grafite + Bio-hidrogel', clipLabelX, clipLabelY + 23);

    // 5. Mini Osciloscópio Fitoeletrônico (Quadrante Superior Direito Dedicado)
    const waveBoxX = Math.max(centerX + 115, Math.floor(w * 0.46));
    const waveBoxY = 16;
    const waveBoxW = Math.max(150, w - waveBoxX - 12);
    const waveBoxH = 92;

    // Fundo do osciloscópio
    ctx.fillStyle = 'rgba(10, 15, 30, 0.92)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(waveBoxX, waveBoxY, waveBoxW, waveBoxH, 6);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(waveBoxX, waveBoxY, waveBoxW, waveBoxH);
      ctx.strokeRect(waveBoxX, waveBoxY, waveBoxW, waveBoxH);
    }

    // Barra de topo do osciloscópio
    ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
    ctx.fillRect(waveBoxX, waveBoxY, waveBoxW, 20);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('📡 SINAL FITOELETRÔNICO (1k/50k)', waveBoxX + 8, waveBoxY + 13);

    // Grade interna do osciloscópio
    const waveDisplayY = waveBoxY + 20;
    const waveDisplayH = waveBoxH - 20;
    const waveMidY = waveDisplayY + waveDisplayH * 0.46;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Linha central
    ctx.moveTo(waveBoxX + 6, waveMidY);
    ctx.lineTo(waveBoxX + waveBoxW - 6, waveMidY);
    // Linha vertical de grade
    ctx.moveTo(waveBoxX + waveBoxW / 2, waveDisplayY + 4);
    ctx.lineTo(waveBoxX + waveBoxW / 2, waveBoxY + waveBoxH - 4);
    ctx.stroke();

    // Desenho da onda senoidal
    ctx.strokeStyle = cfg.waveColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let x = 0; x < waveBoxW - 12; x++) {
      const actualX = waveBoxX + 6 + x;
      const y = waveMidY + Math.sin(x * cfg.waveFreq + currentPhase) * cfg.waveAmp;
      if (x === 0) {
        ctx.moveTo(actualX, y);
      } else {
        ctx.lineTo(actualX, y);
      }
    }
    ctx.stroke();

    // Rótulo de status da seiva/impedância no rodapé do osciloscópio
    ctx.fillStyle = cfg.waveColor;
    ctx.font = 'bold 8px monospace';
    // Trunca texto se exceder a largura do osciloscópio
    let labelTexto = cfg.label;
    if (labelTexto.length > 28 && waveBoxW < 180) {
      labelTexto = labelTexto.substring(0, 26) + '...';
    }
    ctx.fillText(labelTexto, waveBoxX + 6, waveBoxY + waveBoxH - 6);
    ctx.stroke();

    currentPhase += cfg.waveSpeed;
    animationFrameId = requestAnimationFrame(draw);
  }

  draw();

  return {
    destroy: () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', resize);
    },
    setState: (st) => setPlantState(st)
  };
}
