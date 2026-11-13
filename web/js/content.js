/**
 * Tekó Biotech — Base de Conhecimento e Conteúdo
 * Hackathon das Engenharias UERGS 2026
 * Desafio 02: Água para o Futuro e Drenagem Urbana (Agricultura Familiar no RS)
 */

export const CONFIG_SOLOS = {
  arenoso: {
    id: 'arenoso',
    nome: 'Solo Arenoso (Leve / Litoral)',
    nomeCurto: 'Arenoso',
    icone: '🏖️',
    ccKpa: 10.0,
    estresseKpa: 30.0,
    severoKpa: 60.0,
    murchaKpa: 1500.0,
    litrosDiaHaPoupados: 4800,
    reaisDiaHaPoupados: 43.5,
    descricao: 'Drena rapidamente por gravidade (macroporos). Início do estresse hídrico em 30 kPa.',
    orientacaoBomba: 'Turnos curtos e frequentes. Em 30 kPa já necessita de irrigação imediata.'
  },
  franco: {
    id: 'franco',
    nome: 'Solo Franco / Médio',
    nomeCurto: 'Franco (Médio)',
    icone: '🌾',
    ccKpa: 22.0,
    estresseKpa: 45.0,
    severoKpa: 80.0,
    murchaKpa: 1500.0,
    litrosDiaHaPoupados: 4200,
    reaisDiaHaPoupados: 38.0,
    descricao: 'Textura média equilibrada. Capacidade de campo ideal em 22 kPa e estresse em 45 kPa.',
    orientacaoBomba: 'Gotejamento matinal cirúrgico (40 min às 6h) antes da evaporação do meio-dia.'
  },
  argiloso: {
    id: 'argiloso',
    nome: 'Solo Argiloso (Terra Roxa / Várzea)',
    nomeCurto: 'Argiloso',
    icone: '🧱',
    ccKpa: 33.0,
    estresseKpa: 65.0,
    severoKpa: 120.0,
    murchaKpa: 1500.0,
    litrosDiaHaPoupados: 5400,
    reaisDiaHaPoupados: 49.0,
    descricao: 'Microporos retêm água fortemente. Capacidade de campo em 33 kPa; estresse apenas > 65 kPa.',
    orientacaoBomba: 'Demora a secar. Em 33 kPa não ligue a bomba, pois há água de sobra para as raízes.'
  }
};

export const MUNICIPIOS_RS = {
  // 1. Serra & Encosta Superior (Hortifrutigranjeiros, Maçã & Uva)
  bento_goncalves: { nome: 'Bento Gonçalves', regiao: 'Serra Gaúcha', lat: -29.1722, lon: -51.5189, alt: 620, vocacao: 'Vitivinicultura & Olericultura' },
  caxias_do_sul: { nome: 'Caxias do Sul', regiao: 'Serra Gaúcha', lat: -29.1678, lon: -51.1794, alt: 817, vocacao: 'Pólo Hortigranjeiro' },
  vacaria: { nome: 'Vacaria', regiao: 'Campos de Cima da Serra', lat: -28.5122, lon: -50.9339, alt: 971, vocacao: 'Maçã & Fruticultura Temperada' },
  flores_da_cunha: { nome: 'Flores da Cunha', regiao: 'Serra Gaúcha', lat: -29.0289, lon: -51.1883, alt: 756, vocacao: 'Hortaliças & Uva' },
  farroupilha: { nome: 'Farroupilha', regiao: 'Serra Gaúcha', lat: -29.2236, lon: -51.3469, alt: 783, vocacao: 'Kiwi, Pêssego & Olericultura' },

  // 2. Planalto Médio, Alto Uruguai & Missões (Grãos, Soja, Milho, Trigo)
  passo_fundo: { nome: 'Passo Fundo', regiao: 'Planalto Médio', lat: -28.2628, lon: -52.4067, alt: 687, vocacao: 'Grãos (Soja, Trigo, Milho)' },
  cruz_alta: { nome: 'Cruz Alta', regiao: 'Planalto Médio', lat: -28.6389, lon: -53.6067, alt: 452, vocacao: 'Grandes Culturas & Sementes' },
  ijui: { nome: 'Ijuí', regiao: 'Noroeste', lat: -28.3878, lon: -53.9147, alt: 328, vocacao: 'Bacia Leiteira & Grãos' },
  erechim: { nome: 'Erechim', regiao: 'Alto Uruguai', lat: -27.6342, lon: -52.2739, alt: 783, vocacao: 'Agricultura Familiar & Grãos' },
  santo_angelo: { nome: 'Santo Ângelo', regiao: 'Missões', lat: -28.2992, lon: -54.2631, alt: 286, vocacao: 'Soja, Milho & Pastagens' },
  santa_rosa: { nome: 'Santa Rosa', regiao: 'Noroeste', lat: -27.8711, lon: -54.4811, alt: 277, vocacao: 'Berço da Soja & Suinocultura' },
  carazinho: { nome: 'Carazinho', regiao: 'Planalto Médio', lat: -28.2839, lon: -52.7864, alt: 603, vocacao: 'Pólo Olerícola & Grãos' },

  // 3. Depressão Central, Vale do Rio Pardo & Taquari (Arroz, Fumo, Olericultura, Várzea)
  santa_maria: { nome: 'Santa Maria', regiao: 'Depressão Central', lat: -29.6842, lon: -53.8069, alt: 113, vocacao: 'Arroz Irrigado & Olericultura' },
  santa_cruz_do_sul: { nome: 'Santa Cruz do Sul', regiao: 'Vale do Rio Pardo', lat: -29.7144, lon: -52.4278, alt: 73, vocacao: 'Agricultura Familiar & Hortaliças' },
  lajeado: { nome: 'Lajeado', regiao: 'Vale do Taquari', lat: -29.4669, lon: -51.9614, alt: 34, vocacao: 'Hortifrutigranjeiros & Avicultura' },
  cachoeira_do_sul: { nome: 'Cachoeira do Sul', regiao: 'Depressão Central', lat: -30.0389, lon: -52.8939, alt: 68, vocacao: 'Várzea & Arroz Irrigado' },
  venancio_aires: { nome: 'Venâncio Aires', regiao: 'Vale do Rio Pardo', lat: -29.6139, lon: -52.1931, alt: 42, vocacao: 'Minifúndios Diversificados' },

  // 4. Zona Sul & Costa Doce (Hortaliças, Pêssego, Arroz & Minifúndios)
  pelotas: { nome: 'Pelotas', regiao: 'Zona Sul', lat: -31.7654, lon: -52.3376, alt: 7, vocacao: 'Pólo Hortícola & Pêssego' },
  cangucu: { nome: 'Canguçu', regiao: 'Zona Sul', lat: -31.3956, lon: -52.6756, alt: 436, vocacao: 'Cap. Nac. da Agricultura Familiar' },
  rio_grande: { nome: 'Rio Grande', regiao: 'Litoral Sul', lat: -32.0350, lon: -52.0986, alt: 5, vocacao: 'Cebola & Arroz de Várzea' },
  sao_lourenco_do_sul: { nome: 'São Lourenço do Sul', regiao: 'Costa Doce', lat: -31.3653, lon: -51.9778, alt: 19, vocacao: 'Hortaliças, Leite & Fumo' },
  bage: { nome: 'Bagé', regiao: 'Campanha Meridional', lat: -31.3314, lon: -54.1069, alt: 242, vocacao: 'Pecuária, Soja & Olivoturismo' },

  // 5. Fronteira Oeste & Campanha (Arroz Irrigado & Pecuária Sustentável)
  uruguaiana: { nome: 'Uruguaiana', regiao: 'Fronteira Oeste', lat: -29.7547, lon: -57.0883, alt: 66, vocacao: 'Maior Bacia de Arroz Irrigado' },
  alegrete: { nome: 'Alegrete', regiao: 'Fronteira Oeste', lat: -29.7828, lon: -55.7919, alt: 102, vocacao: 'Várzeas & Agricultura Irrigada' },
  sao_borja: { nome: 'São Borja', regiao: 'Fronteira Oeste', lat: -28.6606, lon: -56.0044, alt: 123, vocacao: 'Arroz, Soja & Trigo' },
  santana_do_livramento: { nome: 'Santana do Livramento', regiao: 'Campanha', lat: -30.8878, lon: -55.5328, alt: 208, vocacao: 'Vitivinicultura & Grãos' },
  dom_pedrito: { nome: 'Dom Pedrito', regiao: 'Campanha', lat: -30.9828, lon: -54.6731, alt: 141, vocacao: 'Vinho da Campanha & Arroz' },

  // 6. Região Metropolitana & Litoral Norte (Cinturão Verde & Citros)
  porto_alegre: { nome: 'Porto Alegre', regiao: 'Metropolitana', lat: -30.0346, lon: -51.2177, alt: 10, vocacao: 'Cinturão Verde Olerícola' },
  viamao: { nome: 'Viamão', regiao: 'Metropolitana', lat: -30.0811, lon: -51.0233, alt: 111, vocacao: 'Maior Produtor Arroz Orgânico' },
  torres: { nome: 'Torres', regiao: 'Litoral Norte', lat: -29.3353, lon: -49.7269, alt: 16, vocacao: 'Bananicultura & Hortaliças' },
  osorio: { nome: 'Osório', regiao: 'Litoral Norte', lat: -29.8911, lon: -50.2708, alt: 16, vocacao: 'Hortaliças & Bacia Hidrográfica' },
  montenegro: { nome: 'Montenegro', regiao: 'Vale do Caí', lat: -29.6889, lon: -51.4608, alt: 31, vocacao: 'Capital da Citricultura' }
};

export const CUSTOS_ASSOCIADOS_INSTALACAO = [
  { item: 'BOM Puro de Componentes (Nó Sentinela)', fornecedor: 'AliExpress / Shopee / ML', custo: 42.0 },
  { item: 'Mão de Obra de Montagem e Solda SMD/THT', fornecedor: 'Técnico local / Lote artesanal', custo: 15.0 },
  { item: 'Frete Consolidado e Logística Rural', fornecedor: 'Transportadora regional RS', custo: 5.0 },
  { item: 'Estaca de Campo, Fixação Mecânica e Instalação', fornecedor: 'Materiais de fixação local', custo: 8.0 }
];

/**
 * Perfis de Cultura de Referência Científica (Embrapa Hortaliças & Milho e Sorgo)
 * Limites reais de Tensão Matricial (kPa) para manejo de irrigação por tensiometria.
 */
export const PERFIS_CULTURA = {
  olericultura_alface_argissolo: {
    id: 'olericultura_alface_argissolo',
    cultura: 'Alface Crespa',
    categoria: 'Olericultura (Hortaliças)',
    icone: '🥬',
    solo: 'Argissolo (Textura Média)',
    noId: 'esp32_no_01',
    ccKpa: 12.0,
    alertaKpa: 20.0,
    manejoKpa: 28.0,
    murchaKpa: 40.0,
    taxaSecagemPadrao: 2.0,
    fonte: 'Embrapa Hortaliças - Tensiometria',
    descricao: 'Raízes superficiais (20 cm). Manejo crítico da Embrapa em 28 kPa.'
  },
  graos_milho_argissolo: {
    id: 'graos_milho_argissolo',
    cultura: 'Milho (Vegetativo)',
    categoria: 'Grãos (Estágio Vegetativo)',
    icone: '🌽',
    solo: 'Argissolo (Textura Média)',
    noId: 'esp32_no_02',
    ccKpa: 18.0,
    alertaKpa: 35.0,
    manejoKpa: 50.0,
    murchaKpa: 80.0,
    taxaSecagemPadrao: 2.0,
    fonte: 'Embrapa Milho e Sorgo / Watermark 200SS',
    descricao: 'Raízes mais profundas (40 cm). Limite crítico da Embrapa em 50 kPa.'
  },
  olericultura_tomate_argissolo: {
    id: 'olericultura_tomate_argissolo',
    cultura: 'Tomate / Morango',
    categoria: 'Olericultura (Frutos)',
    icone: '🍅',
    solo: 'Argissolo (Textura Média)',
    noId: 'esp32_no_04',
    ccKpa: 15.0,
    alertaKpa: 30.0,
    manejoKpa: 38.0,
    murchaKpa: 60.0,
    taxaSecagemPadrao: 2.2,
    fonte: 'Embrapa Hortaliças',
    descricao: 'Sensível a estresse durante floração e pegamento (38 kPa).'
  },
  graos_feijao_textura_media: {
    id: 'graos_feijao_textura_media',
    cultura: 'Feijão',
    categoria: 'Leguminosas',
    icone: '🫘',
    solo: 'Textura Média',
    noId: 'esp32_no_03',
    ccKpa: 20.0,
    alertaKpa: 35.0,
    manejoKpa: 45.0,
    murchaKpa: 70.0,
    taxaSecagemPadrao: 1.8,
    fonte: 'Embrapa Arroz e Feijão / Clima Temperado',
    descricao: 'Período crítico no florescimento; limite de manejo a 45 kPa.'
  }
};

/**
 * Calcula a previsão de estresse hídrico (dias restantes) com base
 * na taxa de secagem (ΔkPa/dia) e no limite crítico da Embrapa.
 */
export function calcularPredicaoSecagem(tensaoAtualKpa, idPerfil = 'olericultura_alface_argissolo', taxaSecagem = 2.0) {
  const p = PERFIS_CULTURA[idPerfil] || PERFIS_CULTURA.olericultura_alface_argissolo;
  const t = Math.max(0.0, parseFloat(tensaoAtualKpa) || p.ccKpa);
  const taxa = Math.max(0.5, parseFloat(taxaSecagem) || 2.0);
  const deltaAteManejo = p.manejoKpa - t;

  let diasRestantes = 0.0;
  let status = 'IDEAL';
  let cor = '#10b981';
  let mensagem = '';

  if (deltaAteManejo <= 0) {
    diasRestantes = 0.0;
    status = 'CRITICO_IRRIGAR_JA';
    cor = '#ef4444';
    mensagem = `🚨 URGENTE: Limite Embrapa (${p.manejoKpa} kPa) ultrapassado! Tensão: ${t.toFixed(1)} kPa. Irrigue imediatamente.`;
  } else {
    diasRestantes = Math.round((deltaAteManejo / taxa) * 10) / 10;
    if (diasRestantes <= 1.0 || t >= p.alertaKpa) {
      status = 'ALERTA_IMINENTE';
      cor = diasRestantes <= 1.0 ? '#ef4444' : '#f59e0b';
      mensagem = `⚠️ ATENÇÃO: ${p.cultura} secando a ${taxa.toFixed(1)} kPa/dia. Restam ${diasRestantes} dia(s) para o limite (${p.manejoKpa} kPa).`;
    } else if (diasRestantes <= 3.0) {
      status = 'ATENCAO_PREVENTIVA';
      cor = '#f59e0b';
      mensagem = `🌾 MONITORAMENTO: Secagem normal (${taxa.toFixed(1)} kPa/dia). Restam aprox. ${diasRestantes} dias até o manejo.`;
    } else {
      status = 'IDEAL';
      cor = '#10b981';
      mensagem = `🌿 BOM ESTADO: Solo com água plena. Previsão de ${diasRestantes} dias até o ponto de manejo.`;
    }
  }

  return {
    perfil: p,
    tensaoAtualKpa: t,
    taxaSecagemKpaDia: taxa,
    diasRestantes,
    status,
    cor,
    mensagem
  };
}

/**
 * Calcula a porcentagem de Água Disponível (AD %) para a planta com base
 * na curva de retenção do solo (Capacidade de Campo -> Estresse -> Ponto de Murcha).
 */
export function calcularAguaDisponivel(tensaoKpa, tipoSolo = 'franco') {
  const cfg = CONFIG_SOLOS[tipoSolo] || CONFIG_SOLOS.franco;
  const t = Math.max(0.0, parseFloat(tensaoKpa) || 0.0);

  let adPct = 100.0;
  if (t <= cfg.ccKpa) {
    adPct = 100.0;
  } else if (t <= cfg.estresseKpa) {
    // Da Capacidade de Campo (100%) até o Início de Estresse (50%)
    const fator = (t - cfg.ccKpa) / (cfg.estresseKpa - cfg.ccKpa);
    adPct = 100.0 - (fator * 50.0);
  } else if (t <= cfg.murchaKpa) {
    // Do Estresse (50%) até o Ponto de Murcha Permanente (0%)
    const logAtual = Math.log10(Math.max(1.0, t));
    const logEstresse = Math.log10(cfg.estresseKpa);
    const logMurcha = Math.log10(cfg.murchaKpa);
    const fator = (logAtual - logEstresse) / (logMurcha - logEstresse);
    adPct = Math.max(0.0, 50.0 - (fator * 50.0));
  } else {
    adPct = 0.0;
  }

  adPct = Math.round(adPct);

  let condicao = 'Ótima (Água Plena)';
  let cor = '#10b981';
  if (t < (cfg.ccKpa * 0.4)) {
    condicao = 'Solo Encharcado (Risco de Hipóxia)';
    cor = '#ef4444';
  } else if (adPct >= 60) {
    condicao = 'Capacidade de Campo (Ideal)';
    cor = '#10b981';
  } else if (adPct >= 40) {
    condicao = 'Faixa de Irrigação (Início de Estresse)';
    cor = '#f59e0b';
  } else {
    condicao = 'Seca Severa / Estresse Crítico';
    cor = '#ef4444';
  }

  return {
    porcentagem: adPct,
    condicao,
    cor,
    tipoSolo: cfg.id,
    soloNome: cfg.nomeCurto,
    ccKpa: cfg.ccKpa,
    estresseKpa: cfg.estresseKpa
  };
}

/**
 * Classifica dinamicamente o estado eletrofisiológico de acordo com a textura do solo.
 */
export function classificarEstadoSolo(tensaoKpa, orpMv, tipoSolo = 'franco') {
  const cfg = CONFIG_SOLOS[tipoSolo] || CONFIG_SOLOS.franco;
  const t = parseFloat(tensaoKpa) || 0.0;
  const orp = parseFloat(orpMv) || 0.0;

  // Hipóxia: solo saturado por enchente (tensão abaixo de 40% da CC) ou anóxia redox
  if (t < (cfg.ccKpa * 0.45) || orp < -100.0) {
    return 'hipoxia';
  }
  // Sede: tensão superou o ponto de início de estresse hídrico do solo
  if (t > cfg.estresseKpa) {
    return 'sede';
  }
  return 'hidratada';
}

export const TELEMETRIA_ESTADOS = {
  hidratada: {
    id: 'hidratada',
    titulo: '🌿 HIDRATADA',
    resumoCurto: 'Ψm = 21.5 kPa | Z = 1.4 kΩ | ORP = +310 mV',
    badge: 'Saudável',
    badgeClass: 'badge-verde',
    corStatus: '#10b981',
    tensaoKpa: '21.5 kPa',
    z50k: '1.4 kΩ',
    z1k: '1.1 kΩ',
    orp: '+310 mV',
    ce: '1.2 dS/m',
    statusBomba: 'BOMBA DESLIGADA',
    bombaClass: 'bomba-desligada',
    economiaDestaque: 'Economia de 4.200 litros e R$ 38,00 de luz/diesel hoje',
    diagnostico: 'A seiva está circulando com vigor nas células. As aquaporinas estão abertas e a planta tem água de sobra no caule. Deixe o açude quieto e poupe energia.',
    acaoRecomendada: 'Manter a bomba desligada. Monitoramento sentinela ativo.',
    ttsVoz: 'Planta plenamente hidratada. Pode deixar a irrigação desligada hoje. A seiva está circulando com vigor. Você economizou quatro mil e duzentos litros de água e trinta e oito reais de energia.',
    laudoProagroDisponivel: false
  },
  sede: {
    id: 'sede',
    titulo: '☀️ COM SEDE (SECA INVISÍVEL)',
    resumoCurto: 'Ψm = 45.0 kPa | Z = 4.8 kΩ | ORP = +420 mV',
    badge: 'Alerta de Estiagem',
    badgeClass: 'badge-amarelo',
    corStatus: '#f59e0b',
    tensaoKpa: '45.0 kPa',
    z50k: '4.8 kΩ',
    z1k: '3.9 kΩ',
    orp: '+420 mV',
    ce: '1.8 dS/m',
    statusBomba: 'LIGAR AMANHÃ ÀS 06H',
    bombaClass: 'bomba-programada',
    economiaDestaque: 'Economia de 2.400 litros e R$ 22,00 de diesel hoje com rega cirúrgica de 40 min',
    diagnostico: 'A bioimpedância no caule subiu para 4.8 kΩ indicando desidratação celular precoce, antes mesmo das folhas murcharem sob o sol forte. Solo começa a secar.',
    acaoRecomendada: 'Ligue o gotejamento amanhã bem cedo (às 6h) por 40 minutos. Evite irrigar no calor do meio-dia para não perder água por evaporação.',
    ttsVoz: 'Atenção, produtor: a planta está com sede invisível. O caule acusa perda de turgor. Ligue o gotejamento amanhã às seis da manhã por quarenta minutos. Essa rega cirúrgica economiza dois mil e quatrocentos litros de água e vinte e dois reais de diesel.',
    laudoProagroDisponivel: false
  },
  hipoxia: {
    id: 'hipoxia',
    titulo: '🌊 AFOGADA / PÓS-ENCHENTE',
    resumoCurto: 'Ψm = 4.2 kPa | Z = 5.9 kΩ | ORP = -140 mV',
    badge: 'Risco de Asfixia Radicular',
    badgeClass: 'badge-vermelho',
    corStatus: '#ef4444',
    tensaoKpa: '4.2 kPa',
    z50k: '5.9 kΩ',
    z1k: '5.1 kΩ',
    orp: '-140 mV',
    ce: '0.6 dS/m (Lixiviado)',
    statusBomba: 'NÃO LIGAR A BOMBA!',
    bombaClass: 'bomba-proibida',
    economiaDestaque: 'Economia de 4.200 litros e R$ 38,00 de diesel hoje ao suspender a bomba no alagamento',
    diagnostico: 'Divergência Crítica: O solo está 100% saturado de água após o temporal, mas a raiz está sufocada (-140 mV). A falta de oxigênio fecha as aquaporinas e a planta morre de "seca fisiológica".',
    acaoRecomendada: 'Abra valetas de drenagem imediatamente na cabeceira da lavoura. Não adicione água nem fertilizante nitrogenado. Emita o laudo técnico do PROAGRO abaixo.',
    ttsVoz: 'Alerta grave de enchente! A terra está cheia de água, mas a raiz está sem ar e sufocando. Não ligue a motobomba! Ao manter a bomba desligada você economiza quatro mil e duzentos litros de água e trinta e oito reais de combustível, além de evitar apodrecer a raiz. Abra valetas de drenagem e emita agora o laudo do PROAGRO.',
    laudoProagroDisponivel: true
  }
};

export const FAQ_PRODUTOR = [
  {
    pergunta: 'Esse grampo dá choque ou machuca a planta?',
    resposta: 'Não! O clipe foi desenhado especialmente para a agricultura familiar. Ele usa uma almofadinha macia de gel natural à base de ágar vegetal, glicerol e sal fisiológico. A corrente elétrica é na faixa de microampères (µA), mil vezes menor que uma pilha de relógio. Não queima, não corta e a planta continua crescendo livremente.'
  },
  {
    pergunta: 'De onde vem a energia? Precisa trocar pilha?',
    resposta: 'Não precisa trocar pilha na roça! O circuito do ESP32-C3 opera em modo de sono profundo (Deep Sleep) consumindo quase zero energia. Ele acorda por 2 segundos a cada meia hora e colhe energia das próprias bactérias que vivem na terra junto à raiz (Célula Microbiana P-MFC) combinada a uma mini plaquinha solar. Dura a safra inteira sem manutenção.'
  },
  {
    pergunta: 'E se a enchente cobrir o aparelho de barro e água?',
    resposta: 'O aparelho foi projetado para os temporais severos do Rio Grande do Sul. Toda a placa eletrônica é fundida em resina impermeável de poliuretano vegetal de mamona com certificação IP68. Ele pode ficar submerso na água e na lama. Se a internet cair, a memória interna (LittleFS) guarda até 30 dias de leituras completas.'
  },
  {
    pergunta: 'Como isso me ajuda a pedir o seguro PROAGRO?',
    resposta: 'Em enchentes, os peritos tradicionais acham que a lavoura tem água suficiente porque o chão está molhado. O Tekó Biotech gera um laudo oficial comprovando que a raiz sofreu hipóxia (anóxia radicular abaixo de -100 mV) e que as aquaporinas fecharam, provando cientificamente o sinistro e acelerando a indenização do banco.'
  }
];

export const PILARES_ENGENHARIA = [
  {
    titulo: '1. Clipe de Caule com Espectroscopia de Bioimpedância Dupla',
    subtitulo: 'Frequências de 1 kHz e 50 kHz não invasivas',
    descricao: 'Eletrodos de grafite com interface em bio-hidrogel (ágar + glicerol + KCl). A corrente de 50 kHz atravessa a capacitância da membrana plasmática medindo o turgor celular simplástico real, enquanto 1 kHz avalia a resistência apoplástica e o fluxo de seiva no xilema.'
  },
  {
    titulo: '2. Detecção de Hipóxia Radicular vs. Fechamento de Aquaporinas',
    subtitulo: 'Potencial Redox (ORP) e Condutividade da Rizosfera',
    descricao: 'Durante inundações, a saturação do solo esgota o O2 dissolvido, colapsando o ORP abaixo de -100 mV. Sem fosforilação oxidativa, cessa a produção de ATP celular; as aquaporinas (canais PIP) fecham, causando "seca fisiológica" severa em solo saturado.'
  },
  {
    titulo: '3. Bioenergia Autônoma (Plant-Microbial Fuel Cell + Deep Sleep)',
    subtitulo: 'Colheita de exsudatos da raiz por Geobacter spp.',
    descricao: 'Ânodo de feltro de carbono instalado na rizosfera catalisa a oxidação anaeróbica de exsudatos radiculares gerando 0,45V a 0,65V contínuos. Aliado ao Deep Sleep de 10 µA (14 mAh/dia), o balanço energético é positivo sem dependência de tomadas.'
  },
  {
    titulo: '4. Blindagem Rural IP68 e Memória Circular LittleFS',
    subtitulo: 'Poliuretano vegetal de mamona e resiliência offline',
    descricao: 'Encapsulamento maciço (potting) que impede corrosão iônica por fertilizantes e umidade extrema. Em caso de blackout na rede celular durante tempestades, um buffer circular em LittleFS preserva 30 dias de dados minuto a minuto com CRC32.'
  }
];

export const DADOS_GRAFICO_DIVERGENCIA = {
  labels: ['Dia 1 (Normal)', 'Dia 2 (Seco)', 'Dia 3 (Irrigado)', 'Dia 4 (Normal)', 'Dia 5 (Chuva leve)', 'Dia 6 (ENCHENTE)', 'Dia 7 (Pós-Enchente)'],
  saudeCaule: [82, 60, 88, 84, 85, 25, 20],        // Tekó Biotech: despenca no Dia 6 devido à asfixia radicular
  sensorSolo: [65, 42, 75, 68, 80, 100, 100],      // Sensor Comum de Solo: marca 100% e engana o produtor!
  limiteCritico: [40, 40, 40, 40, 40, 40, 40]
};

export const DADOS_GRAFICO_ENERGIA = {
  labels: ['ESP32 Comum (Ligado Direto)', 'Tekó Biotech (Deep Sleep 10µA)', 'Geração Bio-Solar (P-MFC + Mini Painel)'],
  consumo: [1800, 14, 45], // mAh/dia (escala logarítmica)
  cores: ['#ef4444', '#10b981', '#38bdf8']
};

/**
 * Tabela Científica de Potencial Matricial (Ψm), Água Disponível (AD %) e Condição da Planta
 * Referência Clássica de Manejo e Física do Solo (Embrapa).
 */
export const ESTADOS_HIDRICOS_SOLO = [
  {
    estado: 'Saturação',
    potencialMatricial: '0 kPa',
    aguaDisponivel: '100%',
    condicao: 'Excesso de água e falta de oxigênio nas raízes (hipóxia/anóxia radicular).',
    cor: '#38bdf8'
  },
  {
    estado: 'Capacidade de Campo (CC)',
    potencialMatricial: '-10 kPa (arenoso) a -33 kPa (argiloso)',
    aguaDisponivel: '100% (Limite superior)',
    condicao: 'Condição ideal de umidade e aeração.',
    cor: '#10b981'
  },
  {
    estado: 'Início do Estresse (Fator p)',
    potencialMatricial: '-30 kPa a -70 kPa',
    aguaDisponivel: '40% a 60% restantes',
    condicao: 'Ponto crítico para reiniciar a irrigação sem perda produtiva.',
    cor: '#f59e0b'
  },
  {
    estado: 'Estresse Moderado a Severo',
    potencialMatricial: '-100 kPa a -500 kPa',
    aguaDisponivel: '15% a 35% restantes',
    condicao: 'Fechamento estomático, redução da fotossíntese e murcha.',
    cor: '#ef4444'
  },
  {
    estado: 'Ponto de Murcha Permanente (PMP)',
    potencialMatricial: '-1.500 kPa (-1,5 MPa)',
    aguaDisponivel: '0%',
    condicao: 'Água fortemente retida; a planta não recupera a turgidez.',
    cor: '#7f1d1d'
  }
];

/**
 * Arquitetura Geral da Ninhura (Topologia Mesh ESP-NOW + Gateway)
 */
export const ARQUITETURA_NINHURA = {
  camadaAquisicao: [
    { no: 'Nó 1', micro: 'ESP32', sensor: 'Potencial Matricial (Ψm) + Bioimpedância', cultura: 'Alface Crespa', talhao: 'Talhão 01' },
    { no: 'Nó 2', micro: 'ESP32', sensor: 'Potencial Matricial (Ψm) + CE Solos', cultura: 'Milho Vegetativo', talhao: 'Talhão 02' },
    { no: 'Nó 3', micro: 'ESP32', sensor: 'Potencial Matricial (Ψm) + Redox ORP', cultura: 'Feijão', talhao: 'Talhão 03' }
  ],
  protocoloLocal: 'ESP-NOW (2.4 GHz sem fio ponto-a-multiponto de ultra-baixo consumo)',
  gateway: {
    dispositivo: 'ESP32 Gateway',
    funcao: 'Recepção dos pacotes ESP-NOW, identificação do talhão e encaminhamento seguro',
    uplink: 'Wi-Fi / 4G LTE via HTTP POST'
  },
  backendFastapi: {
    bancoDados: 'SQLite (Leituras históricas 7 dias + Telemetria ao vivo + Perfis Embrapa)',
    motorAlertas: 'Regras agronômicas Embrapa + Predição de taxa de secagem (ΔkPa/dia) + Fator p'
  },
  aplicacoes: {
    dashboard: 'WebApp Mobile-First (Gráficos em tempo real, visualização da Ninhura, Laudo PROAGRO)',
    telegramBot: 'Alertas automáticos, consultas em linguagem simples e síntese de voz (TTS) para agricultores'
  },
  decisaoEngenharia: 'O ESP32 NÃO se comunica diretamente com o Telegram: os nós operam em Deep Sleep via rádio ESP-NOW leve (sem o pesado handshake TLS/TCP do Telegram), economizando bateria por semanas. Toda a lógica de regras agronômicas, alertas e formatação reside no FastAPI.'
};

