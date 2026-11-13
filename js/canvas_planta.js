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
    const width = Math.floor(rect.width || 340);
    const height = Math.floor(rect.height || 260);

    canvasElement.width = width * dpr;
    canvasElement.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);

  function draw() {
    const rect = canvasElement.getBoundingClientRect();
    const w = rect.width || 340;
    const h = rect.height || 260;
    const cfg = STATE_CONFIG[currentState] || STATE_CONFIG.hidratada;

    ctx.clearRect(0, 0, w, h);

    // 1. Fundo do solo (metade inferior)
    const groundY = h * 0.68;
    const soilGrad = ctx.createLinearGradient(0, groundY, 0, h);
    if (currentState === 'hipoxia') {
      soilGrad.addColorStop(0, '#2d2218');
      soilGrad.addColorStop(0.3, '#1c2833'); // aspecto alagado/lodo
      soilGrad.addColorStop(1, '#0b1622');
    } else {
      soilGrad.addColorStop(0, '#2b1d0c');
      soilGrad.addColorStop(1, '#150f07');
    }
    ctx.fillStyle = soilGrad;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Linha do solo
    ctx.strokeStyle = currentState === 'hipoxia' ? '#38bdf8' : '#6b4f2c';
    ctx.lineWidth = currentState === 'hipoxia' ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    if (currentState === 'hipoxia') {
      // Indicador visual de lâmina d'água / enchente
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fillRect(0, groundY - 14, w, 14);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('🌊 Lâmina de Enchente (Solo Saturado 100%)', 12, groundY - 4);
    }

    // 2. Raízes e Haste Basal P-MFC
    const centerX = w * 0.42;

    // Raiz principal
    ctx.strokeStyle = cfg.rootColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, groundY);
    ctx.quadraticCurveTo(centerX - 8, groundY + 30, centerX - 18, h - 20);
    ctx.stroke();

    // Raízes secundárias
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, groundY + 15);
    ctx.quadraticCurveTo(centerX + 24, groundY + 35, centerX + 35, groundY + 55);
    ctx.moveTo(centerX - 10, groundY + 28);
    ctx.quadraticCurveTo(centerX - 35, groundY + 45, centerX - 42, groundY + 65);
    ctx.stroke();

    // Haste Basal P-MFC (Eletrodo ORP / Célula Microbiana)
    const probeX = centerX + 26;
    const probeTopY = groundY - 10;
    const probeBottomY = h - 22;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(probeX, probeTopY);
    ctx.lineTo(probeX, probeBottomY);
    ctx.stroke();

    // Ponta coletora microbiana (feltro de carbono Geobacter)
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(probeX, probeBottomY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Etiqueta P-MFC
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Haste P-MFC', probeX + 10, probeBottomY - 8);
    ctx.fillStyle = cfg.rootColor;
    ctx.fillText(cfg.rootStatus, probeX + 10, probeBottomY + 3);

    // 3. Caule da Planta
    const stemTopY = 32;
    ctx.strokeStyle = currentState === 'sede' ? '#b45309' : '#15803d';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, groundY);
    ctx.quadraticCurveTo(centerX - 6, (groundY + stemTopY) / 2, centerX + 2, stemTopY);
    ctx.stroke();

    // Folhas no topo
    ctx.fillStyle = currentState === 'sede' ? '#d97706' : '#22c55e';
    // Folha esquerda
    ctx.beginPath();
    ctx.moveTo(centerX, stemTopY + 15);
    ctx.quadraticCurveTo(centerX - 45, stemTopY - 5, centerX - 40, stemTopY + 22);
    ctx.quadraticCurveTo(centerX - 20, stemTopY + 25, centerX, stemTopY + 15);
    ctx.fill();

    // Folha direita
    ctx.beginPath();
    ctx.moveTo(centerX, stemTopY + 8);
    ctx.quadraticCurveTo(centerX + 48, stemTopY - 12, centerX + 45, stemTopY + 16);
    ctx.quadraticCurveTo(centerX + 20, stemTopY + 20, centerX, stemTopY + 8);
    ctx.fill();

    // 4. Clipe de Caule Biocompatível Laranja (#ff6b00)
    const clipY = groundY * 0.44;
    const clipX = centerX - 14;
    const clipW = 32;
    const clipH = 18;

    // Hidrogel condutivo macio (ágar + glicerol + KCl)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
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

    // Eletrodos de grafite (duas linhas escuras)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(clipX + 6, clipY + 4, 3, clipH - 8);
    ctx.fillRect(clipX + clipW - 9, clipY + 4, 3, clipH - 8);

    // Rótulo do Clipe
    ctx.fillStyle = '#ff6b00';
    ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Clipe Biossensor (1k / 50 kHz)', clipX + clipW + 8, clipY + 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Grafite + Hidrogel Macio KCl', clipX + clipW + 8, clipY + 20);

    // Fio até o microcontrolador ESP32
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(clipX, clipY + clipH / 2);
    ctx.lineTo(w * 0.12, clipY + clipH / 2);
    ctx.lineTo(w * 0.12, h * 0.22);
    ctx.stroke();
    ctx.setLineDash([]);

    // Caixa do ESP32-C3 IP68
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(w * 0.05, h * 0.14, 52, 28);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w * 0.05, h * 0.14, 52, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('ESP32-C3', w * 0.06, h * 0.14 + 12);
    ctx.fillStyle = '#10b981';
    ctx.fillText('IP68 · 10µA', w * 0.06, h * 0.14 + 22);

    // 5. Onda Senoidal Bioelétrica Interativa no canto direito
    const waveBoxX = w * 0.58;
    const waveBoxY = 20;
    const waveBoxW = w * 0.38;
    const waveBoxH = 68;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.fillRect(waveBoxX, waveBoxY, waveBoxW, waveBoxH);
    ctx.strokeRect(waveBoxX, waveBoxY, waveBoxW, waveBoxH);

    // Linha de base da onda
    const waveMidY = waveBoxY + waveBoxH / 2 + 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(waveBoxX, waveMidY);
    ctx.lineTo(waveBoxX + waveBoxW, waveMidY);
    ctx.stroke();

    // Rótulo da onda
    ctx.fillStyle = cfg.waveColor;
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Sinal Bioelétrico:', waveBoxX + 6, waveBoxY + 12);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '8px monospace';
    ctx.fillText(cfg.label, waveBoxX + 6, waveBoxY + 22);

    // Desenho da onda senoidal
    ctx.strokeStyle = cfg.waveColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < waveBoxW - 4; x++) {
      const actualX = waveBoxX + 2 + x;
      const y = waveMidY + Math.sin(x * cfg.waveFreq + currentPhase) * cfg.waveAmp;
      if (x === 0) {
        ctx.moveTo(actualX, y);
      } else {
        ctx.lineTo(actualX, y);
      }
    }
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
