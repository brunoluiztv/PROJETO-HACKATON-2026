/**
 * PhytoSense RS — Base de Conhecimento e Conteúdo
 * Hackathon das Engenharias UERGS 2026
 * Desafio 02: Água para o Futuro e Drenagem Urbana (Agricultura Familiar no RS)
 */

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
    economiaDestaque: 'Gotejamento cirúrgico de 40 min (3,5 L/metro)',
    diagnostico: 'A bioimpedância no caule subiu para 4.8 kΩ indicando desidratação celular precoce, antes mesmo das folhas murcharem sob o sol forte. Solo começa a secar.',
    acaoRecomendada: 'Ligue o gotejamento amanhã bem cedo (às 6h) por 40 minutos. Evite irrigar no calor do meio-dia para não perder água por evaporação.',
    ttsVoz: 'Atenção, produtor: a planta está com sede invisível. O caule acusa perda de turgor. Ligue o gotejamento amanhã às seis da manhã por quarenta minutos, antes do sol esquentar.',
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
    economiaDestaque: 'Risco de perda total da lavoura por hipóxia',
    diagnostico: 'Divergência Crítica: O solo está 100% saturado de água após o temporal, mas a raiz está sufocada (-140 mV). A falta de oxigênio fecha as aquaporinas e a planta morre de "seca fisiológica".',
    acaoRecomendada: 'Abra valetas de drenagem imediatamente na cabeceira da lavoura. Não adicione água nem fertilizante nitrogenado. Emita o laudo técnico do PROAGRO abaixo.',
    ttsVoz: 'Alerta grave de enchente! A terra está cheia de água, mas a raiz está sem ar e sufocando. Não ligue a bomba! Abra valetas de drenagem e emita agora o laudo do PROAGRO para acionar o seguro.',
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
    resposta: 'Em enchentes, os peritos tradicionais acham que a lavoura tem água suficiente porque o chão está molhado. O PhytoSense RS gera um laudo oficial comprovando que a raiz sofreu hipóxia (anóxia radicular abaixo de -100 mV) e que as aquaporinas fecharam, provando cientificamente o sinistro e acelerando a indenização do banco.'
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
  saudeCaule: [82, 60, 88, 84, 85, 25, 20],        // PhytoSense: despenca no Dia 6 devido à asfixia radicular
  sensorSolo: [65, 42, 75, 68, 80, 100, 100],      // Sensor Comum de Solo: marca 100% e engana o produtor!
  limiteCritico: [40, 40, 40, 40, 40, 40, 40]
};

export const DADOS_GRAFICO_ENERGIA = {
  labels: ['ESP32 Comum (Ligado Direto)', 'PhytoSense RS (Deep Sleep 10µA)', 'Geração Bio-Solar (P-MFC + Mini Painel)'],
  consumo: [1800, 14, 45], // mAh/dia (escala logarítmica)
  cores: ['#ef4444', '#10b981', '#38bdf8']
};
