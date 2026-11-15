/**
 * Tekó Biotech — Simulador 3D WebGL da Planta Sentinela & Biossensor
 * Hackathon das Engenharias UERGS 2026 (Desafio 02: Água e Drenagem Rural)
 *
 * Arquitetura de Representação:
 * - Caule fitoelétrico e turgor celular (pulso simplástico a 50 kHz)
 * - Clipe de Caule com bio-hidrogel KCl (10 mM) e eletrodos de grafite biocompatível
 * - Fluxo apoplástico no xilema (partículas a 1 kHz)
 * - Rizosfera e sistema radicular
 * - Haste basal P-MFC (ORP Geobacter sulfurreducens) com halo bioelétrico
 * - Lâmina de água de inundação e anóxia no estado de hipóxia
 * - Otimização de bateria (pausa em background) e conformidade WCAG 2.2 AA
 */

import * as THREE from './vendor/three.module.min.js';

export const ESTADOS_3D_CONFIG = {
  hidratada: {
    nome: 'Hidratada',
    corCaule: 0x15803d,
    corFolhas: 0x22c55e,
    corParticulas: 0x38bdf8,
    velocidadeParticulas: 0.022,
    amplitudePulso: 0.035,
    frequenciaPulso: 3.0,
    escalaCauleBase: 1.0,
    corRaiz: 0x10b981,
    corHalo: 0x10b981,
    intensidadeHalo: 1.0,
    inundacaoAtiva: false,
    rotacaoFolhas: 0.0,
    ariaLabel: 'Modelo 3D interativo: Planta hidratada, seiva ativa a 1 kHz no xilema, clipe KCl com 1.4 kΩ e haste P-MFC oxigenada a +310 mV'
  },
  sede: {
    nome: 'Estresse Hídrico (Sede)',
    corCaule: 0xb45309,
    corFolhas: 0xd97706,
    corParticulas: 0xf59e0b,
    velocidadeParticulas: 0.007,
    amplitudePulso: 0.012,
    frequenciaPulso: 1.2,
    escalaCauleBase: 0.88, // Caule contraído por estresse hídrico
    corRaiz: 0xf59e0b,
    corHalo: 0xf59e0b,
    intensidadeHalo: 0.7,
    inundacaoAtiva: false,
    rotacaoFolhas: 0.28, // Folhas murchas/declinadas
    ariaLabel: 'Modelo 3D interativo: Planta em estresse hídrico, fluxo apoplástico reduzido, caule contraído a 4.8 kΩ e haste P-MFC a +420 mV'
  },
  hipoxia: {
    nome: 'Hipóxia Radicular / Enchente',
    corCaule: 0x1c3d28,
    corFolhas: 0x2b4c38,
    corParticulas: 0xef4444,
    velocidadeParticulas: 0.002,
    amplitudePulso: 0.004,
    frequenciaPulso: 0.8,
    escalaCauleBase: 0.94,
    corRaiz: 0xef4444,
    corHalo: 0xef4444, // Descarga intensa Geobacter (-140 mV)
    intensidadeHalo: 1.6,
    inundacaoAtiva: true, // Lâmina d'água de enchente sobre a rizosfera
    rotacaoFolhas: 0.12,
    ariaLabel: 'Modelo 3D interativo: Planta sob hipóxia e solo alagado por enchente, lâmina d\'água visível, pulso celular estagnado e haste P-MFC com descarga anaeróbia a -140 mV'
  }
};

/**
 * Validação rigorosa de disponibilidade WebGL no ambiente do usuário
 */
export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (err) {
    // Exceção capturada intencionalmente quando WebGL está desabilitado no navegador; aciona fallback 2D.
    console.debug('[Tekó 3D] WebGL indisponível:', err);
    return false;
  }
}

/**
 * Inicializador da cena 3D Three.js acoplado ao elemento Canvas
 * @param {HTMLCanvasElement} canvasElement
 */
export function initPlant3D(canvasElement) {
  if (!canvasElement || !isWebGLAvailable()) {
    return null;
  }

  let renderer = null;
  let scene = null;
  let camera = null;
  let animFrameId = null;
  let isRunning = false;
  let isLightMode = false;
  let estadoKeyAtual = 'hidratada';

  // Grupos e malhas
  let plantGroup = null;
  let stemMesh = null;
  let leavesGroup = null;
  let rootsGroup = null;
  let pMfcRod = null;
  let pMfcTip = null;
  let pMfcHalo = null;
  let floodMesh = null;
  let sapPoints = null;
  let clipGroup = null;
  let soilMesh = null;
  let esp32Led = null;

  // Luzes
  let ambientLight = null;
  let dirLight = null;
  let fillLight = null;

  // Controle de rotação orbital
  let targetYaw = 0.0;
  let currentYaw = 0.0;
  let targetPitch = 0.1;
  let currentPitch = 0.1;
  let isDragging = false;
  let startPointerX = 0;
  let startPointerY = 0;

  // Detecção de preferência de movimento reduzido
  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let prefersReducedMotion = motionQuery ? motionQuery.matches : false;

  if (motionQuery?.addEventListener) {
    motionQuery.addEventListener('change', (e) => {
      prefersReducedMotion = e.matches;
    });
  }

  // 1. Instanciação segura do renderizador WebGL
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvasElement,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  } catch (err) {
    console.warn('[Tekó 3D] Falha na criação do contexto WebGL:', err);
    return null;
  }

  // Tratamento de perda e restauração de contexto WebGL
  const onContextLost = (e) => {
    e.preventDefault();
    pause();
    window.dispatchEvent(new CustomEvent('teko-webgl-lost'));
  };

  const onContextRestored = () => {
    construirCena();
    resume();
    window.dispatchEvent(new CustomEvent('teko-webgl-restored'));
  };

  canvasElement.addEventListener('webglcontextlost', onContextLost, false);
  canvasElement.addEventListener('webglcontextrestored', onContextRestored, false);

  // 2. Construção da Cena 3D e dos Modelos Fitoeletrônicos
  function construirCena() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.45, 4.8);
    camera.lookAt(0, 0.15, 0);

    // Sistema de Iluminação
    ambientLight = new THREE.AmbientLight(0x38bdf8, 0.75);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    fillLight = new THREE.PointLight(0x10b981, 0.4, 10);
    fillLight.position.set(-3, -1, -2);
    scene.add(fillLight);

    plantGroup = new THREE.Group();
    scene.add(plantGroup);

    // A. Solo / Rizosfera
    const soilGeo = new THREE.CylinderGeometry(1.6, 1.48, 1.6, 32);
    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x261b11,
      roughness: 0.92,
      metalness: 0.05
    });
    soilMesh = new THREE.Mesh(soilGeo, soilMat);
    soilMesh.position.set(0, -1.2, 0);
    plantGroup.add(soilMesh);

    // Borda superior da bancada de solo
    const rimGeo = new THREE.CylinderGeometry(1.62, 1.62, 0.04, 32);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x3d2b1c,
      roughness: 0.8
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.set(0, -0.4, 0);
    plantGroup.add(rimMesh);

    // B. Lâmina de Água de Enchente (Ativa no estado 'hipoxia')
    const floodGeo = new THREE.CylinderGeometry(1.64, 1.64, 0.08, 32);
    const floodMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.7,
      roughness: 0.08,
      metalness: 0.25
    });
    floodMesh = new THREE.Mesh(floodGeo, floodMat);
    floodMesh.position.set(0, -0.36, 0);
    floodMesh.visible = false;
    plantGroup.add(floodMesh);

    // C. Sistema Radicular
    rootsGroup = new THREE.Group();
    const rootMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.6
    });

    // Raiz pivotante principal
    const tapRootGeo = new THREE.CylinderGeometry(0.045, 0.015, 1.1, 12);
    const tapRoot = new THREE.Mesh(tapRootGeo, rootMat);
    tapRoot.position.set(-0.04, -0.95, 0.02);
    tapRoot.rotation.z = 0.08;
    rootsGroup.add(tapRoot);

    // Raízes laterais secundárias
    const latGeo1 = new THREE.CylinderGeometry(0.025, 0.01, 0.6, 8);
    const lat1 = new THREE.Mesh(latGeo1, rootMat);
    lat1.position.set(0.18, -0.75, 0.1);
    lat1.rotation.z = -0.55;
    rootsGroup.add(lat1);

    const latGeo2 = new THREE.CylinderGeometry(0.022, 0.008, 0.55, 8);
    const lat2 = new THREE.Mesh(latGeo2, rootMat);
    lat2.position.set(-0.25, -0.85, -0.1);
    lat2.rotation.z = 0.65;
    rootsGroup.add(lat2);

    const latGeo3 = new THREE.CylinderGeometry(0.018, 0.006, 0.45, 8);
    const lat3 = new THREE.Mesh(latGeo3, rootMat);
    lat3.position.set(0.12, -1.15, -0.15);
    lat3.rotation.z = -0.4;
    rootsGroup.add(lat3);

    plantGroup.add(rootsGroup);

    // D. Haste Basal P-MFC (ORP Geobacter)
    const pMfcGroup = new THREE.Group();
    const rodGeo = new THREE.CylinderGeometry(0.028, 0.028, 1.25, 16);
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.25,
      metalness: 0.85
    });
    pMfcRod = new THREE.Mesh(rodGeo, rodMat);
    pMfcRod.position.set(0.48, -0.98, 0.15);
    pMfcGroup.add(pMfcRod);

    // Ponta coletora microbiana (feltro de carbono)
    const tipGeo = new THREE.SphereGeometry(0.065, 16, 16);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.3
    });
    pMfcTip = new THREE.Mesh(tipGeo, tipMat);
    pMfcTip.position.set(0.48, -1.6, 0.15);
    pMfcGroup.add(pMfcTip);

    // Halo bioelétrico bioenergético (emissão eletrogênica Geobacter)
    const haloGeo = new THREE.RingGeometry(0.07, 0.22, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    pMfcHalo = new THREE.Mesh(haloGeo, haloMat);
    pMfcHalo.position.set(0.48, -1.59, 0.15);
    pMfcHalo.rotation.x = Math.PI / 2;
    pMfcGroup.add(pMfcHalo);

    plantGroup.add(pMfcGroup);

    // E. Caule da Planta Sentinela (50 kHz pulso simplástico de turgor)
    const stemGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.0, 24);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.5,
      metalness: 0.05
    });
    stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.set(0, 0.6, 0);
    plantGroup.add(stemMesh);

    // F. Folhagem Superior da Planta
    leavesGroup = new THREE.Group();
    const leafGeo = new THREE.SphereGeometry(0.26, 16, 8);
    leafGeo.scale(1.8, 0.12, 0.55);

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.45
    });

    const leafLeft = new THREE.Mesh(leafGeo, leafMat);
    leafLeft.position.set(-0.38, 1.45, 0.05);
    leafLeft.rotation.z = 0.28;
    leafLeft.rotation.y = -0.15;
    leavesGroup.add(leafLeft);

    const leafRight = new THREE.Mesh(leafGeo, leafMat);
    leafRight.position.set(0.42, 1.35, -0.05);
    leafRight.rotation.z = -0.32;
    leafRight.rotation.y = 0.2;
    leavesGroup.add(leafRight);

    const leafTop = new THREE.Mesh(leafGeo, leafMat);
    leafTop.position.set(0.02, 1.62, 0.12);
    leafTop.scale.set(0.85, 0.85, 0.85);
    leafTop.rotation.x = -0.25;
    leavesGroup.add(leafTop);

    plantGroup.add(leavesGroup);

    // G. Feixe de Partículas de Seiva Apoplástica (1 kHz)
    const totalParticulas = 90;
    const posicoesParticulas = new Float32Array(totalParticulas * 3);

    for (let i = 0; i < totalParticulas; i++) {
      const idx = i * 3;
      const ang = Math.random() * Math.PI * 2;
      const raio = 0.025 + Math.random() * 0.065;
      posicoesParticulas[idx] = Math.cos(ang) * raio;
      posicoesParticulas[idx + 1] = -0.35 + Math.random() * 1.95;
      posicoesParticulas[idx + 2] = Math.sin(ang) * raio;
    }

    const sapGeo = new THREE.BufferGeometry();
    sapGeo.setAttribute('position', new THREE.BufferAttribute(posicoesParticulas, 3));

    const sapMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.048,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    sapPoints = new THREE.Points(sapGeo, sapMat);
    plantGroup.add(sapPoints);

    // H. Clipe de Caule Biocompatível Laranja (#ff6b00) + Bio-hidrogel KCl + Eletrodos de Grafite
    clipGroup = new THREE.Group();
    clipGroup.position.set(0, 0.52, 0);

    // Corpo do clipe plástico laranja
    const clipGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.22, 28, 1, false, 0, Math.PI * 1.6);
    const clipMat = new THREE.MeshStandardMaterial({
      color: 0xff6b00,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide
    });
    const clipBody = new THREE.Mesh(clipGeo, clipMat);
    clipBody.rotation.y = -Math.PI * 0.8;
    clipGroup.add(clipBody);

    // Almofada interna de bio-hidrogel isotônico KCl (10 mM)
    const hydrogelGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.19, 24, 1, false, 0, Math.PI * 1.5);
    const hydrogelMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.82,
      roughness: 0.15,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const hydrogelMesh = new THREE.Mesh(hydrogelGeo, hydrogelMat);
    hydrogelMesh.rotation.y = -Math.PI * 0.75;
    clipGroup.add(hydrogelMesh);

    // Eletrodos de Grafite (par biocompatível)
    const elecGeo = new THREE.BoxGeometry(0.035, 0.13, 0.035);
    const elecMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.85
    });

    const elec1 = new THREE.Mesh(elecGeo, elecMat);
    elec1.position.set(0.14, 0, 0.03);
    clipGroup.add(elec1);

    const elec2 = new THREE.Mesh(elecGeo, elecMat);
    elec2.position.set(-0.13, 0, 0.05);
    clipGroup.add(elec2);

    plantGroup.add(clipGroup);

    // I. Cabo de Sinal e Gabinete ESP32-C3 IP68
    const esp32Group = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(0.32, 0.16, 0.24);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.4
    });
    const esp32Box = new THREE.Mesh(boxGeo, boxMat);
    esp32Box.position.set(-0.76, -0.32, 0.58);
    esp32Group.add(esp32Box);

    // LED de telemetria / atividade do ESP32
    const ledGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    esp32Led = new THREE.Mesh(ledGeo, ledMat);
    esp32Led.position.set(-0.64, -0.23, 0.58);
    esp32Group.add(esp32Led);

    // Fio condutor flexível em curva
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.14, 0.52, 0.03),
      new THREE.Vector3(0.35, 0.35, 0.25),
      new THREE.Vector3(-0.15, 0.05, 0.45),
      new THREE.Vector3(-0.64, -0.3, 0.58)
    ]);
    const wireGeo = new THREE.TubeGeometry(curve, 24, 0.012, 8, false);
    const wireMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.4
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    esp32Group.add(wireMesh);

    plantGroup.add(esp32Group);

    // Aplica o tema atual
    setTheme(isLightMode);
    // Aplica o estado bioelétrico atual
    setPlantState(estadoKeyAtual);
  }

  // 3. Controles Interativos de Rotação por Toque, Mouse e Teclado
  function configurarControles() {
    // Eventos Pointer para arraste orbital suave
    const onPointerDown = (e) => {
      isDragging = true;
      startPointerX = e.clientX;
      startPointerY = e.clientY;
      canvasElement.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startPointerX;
      const deltaY = e.clientY - startPointerY;
      startPointerX = e.clientX;
      startPointerY = e.clientY;

      targetYaw += deltaX * 0.007;
      targetPitch += deltaY * 0.006;
      targetPitch = Math.max(-0.35, Math.min(0.55, targetPitch));
    };

    const onPointerUp = (e) => {
      if (isDragging) {
        isDragging = false;
        try {
          canvasElement.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    };

    canvasElement.addEventListener('pointerdown', onPointerDown);
    canvasElement.addEventListener('pointermove', onPointerMove);
    canvasElement.addEventListener('pointerup', onPointerUp);
    canvasElement.addEventListener('pointercancel', onPointerUp);
    canvasElement.addEventListener('pointerleave', onPointerUp);

    // Controles por teclado acessíveis (WCAG 2.2 AA)
    canvasElement.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          targetYaw -= 0.08;
          e.preventDefault();
          break;
        case 'ArrowRight':
          targetYaw += 0.08;
          e.preventDefault();
          break;
        case 'ArrowUp':
          targetPitch = Math.max(-0.35, targetPitch - 0.06);
          e.preventDefault();
          break;
        case 'ArrowDown':
          targetPitch = Math.min(0.55, targetPitch + 0.06);
          e.preventDefault();
          break;
        case 'r':
        case 'R':
        case 'Home':
          resetCamera();
          e.preventDefault();
          break;
      }
    });
  }

  // 4. Redimensionamento Responsivo
  function resize() {
    if (!renderer || !camera || !canvasElement) return;

    const rect = canvasElement.getBoundingClientRect();
    const width = Math.floor(rect.width || 360);
    const height = Math.floor(rect.height || 340);

    if (width === 0 || height === 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
  }

  // 5. Redefinição da Câmera / Rotação
  function resetCamera() {
    targetYaw = 0.0;
    targetPitch = 0.1;
  }

  // 6. Atualização de Estado Fitoeletrônico
  function setPlantState(novoEstado) {
    if (!ESTADOS_3D_CONFIG[novoEstado]) return;
    estadoKeyAtual = novoEstado;
    const cfg = ESTADOS_3D_CONFIG[novoEstado];

    if (stemMesh) {
      stemMesh.material.color.setHex(cfg.corCaule);
    }

    if (leavesGroup) {
      leavesGroup.children.forEach((leaf) => {
        if (leaf.material) {
          leaf.material.color.setHex(cfg.corFolhas);
        }
      });
      // Declina ou ergue as folhas conforme turgor
      leavesGroup.rotation.x = cfg.rotacaoFolhas;
    }

    if (rootsGroup) {
      rootsGroup.children.forEach((r) => {
        if (r.material) {
          r.material.color.setHex(cfg.corRaiz);
        }
      });
    }

    if (pMfcHalo) {
      pMfcHalo.material.color.setHex(cfg.corHalo);
    }

    if (sapPoints) {
      sapPoints.material.color.setHex(cfg.corParticulas);
    }

    if (floodMesh) {
      floodMesh.visible = cfg.inundacaoAtiva;
    }

    // Atualiza a semântica descritiva acessível do elemento
    canvasElement.setAttribute('aria-label', cfg.ariaLabel);
  }

  // 7. Adaptação Dinâmica ao Tema (Claro / Escuro)
  function setTheme(lightMode) {
    isLightMode = Boolean(lightMode);

    if (!scene || !ambientLight || !dirLight) return;

    if (isLightMode) {
      // Tema Claro (Rural Sol / Alta Visibilidade em Campo)
      ambientLight.color.setHex(0xfffbeb);
      ambientLight.intensity = 1.25;

      dirLight.color.setHex(0xffedd5);
      dirLight.intensity = 1.35;

      if (fillLight) {
        fillLight.color.setHex(0x10b981);
        fillLight.intensity = 0.3;
      }

      if (soilMesh) {
        soilMesh.material.color.setHex(0x4a3523);
      }
    } else {
      // Tema Escuro Oficial Tekó (Fundo #0b100d / Alto Contraste Noturno)
      ambientLight.color.setHex(0x38bdf8);
      ambientLight.intensity = 0.75;

      dirLight.color.setHex(0xffffff);
      dirLight.intensity = 1.1;

      if (fillLight) {
        fillLight.color.setHex(0x10b981);
        fillLight.intensity = 0.4;
      }

      if (soilMesh) {
        soilMesh.material.color.setHex(0x261b11);
      }
    }
  }

  // 8. Loop de Renderização e Animação Fitoelétrica
  let tempo = 0;

  function atualizarFluxoSeiva(cfg) {
    if (!sapPoints) return;
    const posicoes = sapPoints.geometry.attributes.position.array;
    const veloc = prefersReducedMotion ? cfg.velocidadeParticulas * 0.3 : cfg.velocidadeParticulas;

    for (let i = 1; i < posicoes.length; i += 3) {
      posicoes[i] += veloc;
      if (posicoes[i] > 1.6) {
        posicoes[i] = -0.35;
      }
    }
    sapPoints.geometry.attributes.position.needsUpdate = true;
  }

  function atualizarHaloETelemetria(cfg) {
    if (pMfcHalo) {
      const pulsacaoHalo = 1.0 + 0.15 * Math.sin(tempo * 2.5);
      pMfcHalo.scale.set(pulsacaoHalo, pulsacaoHalo, 1.0);
      pMfcHalo.material.opacity = 0.5 + 0.35 * Math.abs(Math.sin(tempo * 2.0)) * cfg.intensidadeHalo;
    }

    if (esp32Led) {
      const ledBrilho = Math.sin(tempo * 4.0) > 0.6 ? 1.0 : 0.2;
      esp32Led.material.color.setHex(ledBrilho > 0.5 ? 0x10b981 : 0x064e3b);
    }

    if (floodMesh?.visible && !prefersReducedMotion) {
      floodMesh.position.y = -0.36 + Math.sin(tempo * 1.8) * 0.008;
    }
  }

  function animar() {
    if (!isRunning) return;

    tempo += 0.02;
    const cfg = ESTADOS_3D_CONFIG[estadoKeyAtual] || ESTADOS_3D_CONFIG.hidratada;

    // A. Interpolação e Amortecimento de Rotação Orbital
    currentYaw += (targetYaw - currentYaw) * 0.1;
    currentPitch += (targetPitch - currentPitch) * 0.1;

    if (!isDragging && !prefersReducedMotion) {
      targetYaw += 0.0018;
    }

    if (plantGroup) {
      plantGroup.rotation.y = currentYaw;
      plantGroup.rotation.x = currentPitch;
    }

    // B. Pulso Simplástico a 50 kHz (Variação transversal de turgor no caule)
    if (stemMesh) {
      const escalaX = cfg.escalaCauleBase * (1.0 + cfg.amplitudePulso * Math.sin(tempo * cfg.frequenciaPulso));
      stemMesh.scale.set(escalaX, 1.0, escalaX);
    }

    // C. Fluxo de Partículas Apoplásticas a 1 kHz e Halo P-MFC
    atualizarFluxoSeiva(cfg);
    atualizarHaloETelemetria(cfg);

    // D. Renderização do Frame WebGL
    renderer.render(scene, camera);

    animFrameId = requestAnimationFrame(animar);
  }

  // 9. Gerenciamento de Ciclo de Vida do WebGL
  function pause() {
    if (!isRunning) return;
    isRunning = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function resume() {
    if (isRunning) return;
    if (document.hidden) return;
    isRunning = true;
    animFrameId = requestAnimationFrame(animar);
  }

  function destroy() {
    pause();

    window.removeEventListener('resize', resize);
    canvasElement.removeEventListener('webglcontextlost', onContextLost);
    canvasElement.removeEventListener('webglcontextrestored', onContextRestored);

    if (renderer) {
      try {
        renderer.dispose();
      } catch (err) {
        // Falha não-crítica ao liberar contexto WebGL já encerrado.
        console.debug('[Tekó 3D] Aviso ao liberar WebGL:', err);
      }
      renderer = null;
    }

    scene = null;
    camera = null;
  }

  // Inicializa componentes
  construirCena();
  configurarControles();
  resize();
  window.addEventListener('resize', resize);

  // Inicia renderização
  resume();

  return {
    setState: (st) => setPlantState(st),
    setTheme: (isLight) => setTheme(isLight),
    pause: () => pause(),
    resume: () => resume(),
    resize: () => resize(),
    resetCamera: () => resetCamera(),
    isSupported: () => true,
    destroy: () => destroy()
  };
}
