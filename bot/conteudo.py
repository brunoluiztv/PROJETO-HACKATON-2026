"""
Conteúdo oficial do Bot Tekó (Tekó Biotech — formato HTML para Telegram).
Tekó: 'Modo de ser e viver em harmonia com a terra' (Tupi-Guarani).
Zero digitação, acolhedor e com termos compreensíveis para o produtor rural.
"""

BTN_PLANTA = "🌱 1. Como está minha planta?"
BTN_BOMBA = "💧 2. Preciso irrigar hoje?"
BTN_CHUVA = "🌧️ 3. Choveu demais (Raiz)"
BTN_BATERIA = "🔋 4. Energia e Manutenção"
BTN_PAINEL = "📊 5. Abrir Gráficos e Laudo PROAGRO"
BTN_SOLO = "🚜 6. Tipo de Solo da Lavoura"

RESPOSTA_SOLO_MENU = (
    "🚜 <b>Qual é o tipo de solo da sua lavoura?</b>\n\n"
    "A textura da terra muda a força com que a água fica retida nas raízes:\n\n"
    "• <b>🏖️ Solo Arenoso:</b> Drena muito rápido (como um coador). Em 30 kPa já precisa irrigar!\n"
    "• <b>🌾 Solo Franco (Médio):</b> Equilibrado. Ponto de irrigação aos 45 kPa.\n"
    "• <b>🧱 Solo Argiloso:</b> Terra roxa de várzea. Segura muita água; em 33 kPa ainda tem água de sobra!\n\n"
    "👇 <b>Toque abaixo no solo do seu talhão para calibrar o biossensor Tekó:</b>"
)

BOAS_VINDAS = (
    "🌱 <b>Buenas, {nome}! Eu sou o Tekó (a voz da sua lavoura · Tekó Biotech).</b>\n\n"
    "Meu nome vem da sabedoria ancestral de viver em harmonia com a terra. "
    "O biossensor instalado no caule da sua planta sentinela mede a água passando por dentro dela "
    "e a respiração da raiz embaixo do solo.\n\n"
    "👇 <b>Você não precisa digitar nada!</b> Toque nos botões grandes aqui embaixo:"
)

AUDIO_RESPOSTA = (
    "🌾 <b>Para facilitar a sua lida na lavoura, o Tekó opera no modo Zero Digitação!</b>\n\n"
    "Não precisa perder tempo gravando áudios nem digitando no celular com a mão na lida ou na terra. "
    "Toque diretamente nos <b>botões grandes do menu abaixo</b> para obter o diagnóstico da sua lavoura em 1 segundo 👇"
)

RESPOSTA_CHUVA_NORMAL = (
    "🌧️ <b>Diagnóstico da Raiz & Drenagem da Chuva:</b>\n\n"
    "✅ <b>Fique tranquilo, o solo está drenando bem!</b>\n\n"
    "A água da chuva infiltrou e a rizosfera está oxigenada:\n"
    "• <b>Oxigenação da Raiz (ORP):</b> {orp_str} mV (Solo aeróbico e saudável)\n"
    "• <b>Tensão do Solo:</b> {tensao} kPa (Umidade adequada)\n"
    "• <b>Situação:</b> As raízes estão respirando livremente e absorvendo água e nutrientes sem nenhum sinal de hipóxia.\n\n"
    "💡 <i>A bomba de irrigação deve permanecer desligada. Aproveite a água natural da chuva!</i>"
)

RESPOSTA_BOMBA_DESLIGADA = (
    "💧 <b>Recomendação de Irrigação (Tekó Biotech):</b>\n\n"
    "🟢 <b>NÃO PRECISA IRRIGAR HOJE! A BOMBA DEVE FICAR DESLIGADA.</b>\n\n"
    "• <b>Tensão Matricial Atual:</b> {tensao} kPa ({faixa})\n"
    "• <b>Vigor da Seiva (Caule):</b> {z_kohm} kΩ (Circulação de seiva plena)\n"
    "• <b>Respiração da Raiz:</b> {orp_str} mV (Boa aeração)\n\n"
    "💰 <b>Economia Real:</b> Ao manter a irrigação desligada hoje, você poupa <b>4.200 litros de água</b> "
    "e cerca de <b>R$ 38,00</b> de energia elétrica/combustível no talhão!"
)

DUVIDAS_PRODUTOR = (
    "🔋 <b>Dúvidas do Produtor sobre o Tekó e o Biossensor:</b>\n\n"
    "1️⃣ <b>Esse grampo dá choque ou machuca a planta?</b>\n"
    "Não! Ele usa uma almofadinha macia de gel natural (ágar e glicerina) e um sinal elétrico mil vezes menor que uma pilha. A planta cresce normal.\n\n"
    "2️⃣ <b>Precisa trocar pilha toda semana?</b>\n"
    "Não! Ele dorme quase o tempo todo e tira energia das próprias bactérias da terra (Célula Microbiana na raiz) junto com uma plaquinha solar. Dura a safra inteira.\n\n"
    "3️⃣ <b>E se a enchente ou a lama cobrir o aparelho no talhão?</b>\n"
    "A caixinha é lacrada com resina maciça de mamona (IP68). Pode ficar debaixo d'água e guarda tudo na memória até a internet voltar!"
)

RESPOSTA_CLIMA_TALHAO = (
    "🌤️ <b>Previsão do Tempo & Vento no Talhão (Open-Meteo RS):</b>\n\n"
    "📍 <b>Localização:</b> Bento Gonçalves, RS (Serra Gaúcha)\n"
    "• <b>Temperatura Atual:</b> 23.5 °C · <b>Umidade:</b> 82%\n"
    "• <b>Chuva Prevista Próximas 24h:</b> 32.0 mm (85% prob.)\n"
    "• <b>Rajadas Máximas de Vento:</b> 42 km/h (Normal)\n\n"
    "💡 <b>Recomendação Inteligente do Tekó:</b>\n"
    "⏳ <b>Não ligue a motobomba hoje!</b> A chuva natural prevista de 32 mm vai recarregar o solo. "
    "Economize o combustível do açude!\n"
    "🛡️ <i>Sem risco crítico de vendaval (> 60 km/h) para estufas no momento.</i>"
)

LAUDO_PROAGRO_TEXTO = (
    "📄 <b>LAUDO TÉCNICO DE ALAGAMENTO & HIPÓXIA RADICULAR (PROAGRO)</b>\n\n"
    "• <b>Emissor:</b> Tekó Biotech — Sistema Sentinela de Biomonitoramento In-Planta\n"
    "• <b>Parâmetros Registrados:</b>\n"
    "  - Potencial Redox (ORP): -140 mV (Hipóxia severa confirmada)\n"
    "  - Bioimpedância de Caule (50 kHz): 5.9 kΩ (Fechamento de aquaporinas)\n"
    "  - Saturação de Solo: 100% por mais de 30 horas consecutivas\n\n"
    "⚠️ <i>Documento com validade agronômica para comprovação de perda por asfixia radicular em seguro rural.</i>"
)

RESPOSTA_PREDICAO_ESTRESSE = (
    "📈 <b>Previsão de Estresse Hídrico & Taxa de Secagem (Tekó + Embrapa)</b>\n\n"
    "• <b>Cultura Ativa:</b> {cultura}\n"
    "• <b>Solo do Talhão:</b> {solo}\n"
    "• <b>Tensão Matricial Atual:</b> {tensao} kPa\n"
    "• <b>Taxa de Secagem do Solo:</b> {taxa} kPa/dia\n"
    "• <b>Limite Crítico de Manejo:</b> {limite} kPa\n"
    "• <b>Estimativa até o Estresse:</b> <b>{dias} dia(s)</b>\n\n"
    "📌 <b>Orientação:</b> {mensagem}\n"
    "🔬 <i>Parâmetros ancorados em tensiometria oficial: {fonte}</i>"
)

