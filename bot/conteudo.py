"""Textos do bot AgroSponge RS (fonte única de conteúdo, formato HTML do Telegram).

Os números principais espelham web/js/content.js. Os testes conferem os valores.
"""

LITROS_POR_SACO = 13
CUSTO_SACO_REAIS = "5,80"

BTN_FOTO = "📷 1. Ver cor do selo"
BTN_SECA = "💧 2. Água pra seca"
BTN_USAR = "🌾 3. Como usar na terra"
BTN_RECEITA = "🛠️ 4. Fazer saco caseiro"
BTN_PAINEL = "📊 5. Abrir Painel e Gráficos"

BOAS_VINDAS = (
    "🌱 <b>Buenas, {nome}! Eu sou o Assistente AgroSponge RS.</b>\n\n"
    "Estou aqui pra te ajudar a segurar a enxurrada e guardar água limpa pra época de seca.\n\n"
    "👇 <b>Você não precisa digitar nada!</b> Basta tocar em um dos botões grandes aqui embaixo "
    "ou me mandar uma <b>foto do selo</b> do seu saco:"
)

AUDIO = (
    "🎧 <b>Recebi seu áudio, amigo(a)!</b>\n\n"
    "Se a sua dúvida é saber se pode colocar o saco cheio d'água na horta:\n"
    "👉 Me mande uma <b>FOTO da fitinha</b> colada no saco, ou toque na cor que apareceu nela aqui embaixo:"
)

PEDIR_FOTO = (
    "📷 <b>Me mande uma foto da fitinha</b> colada no saco ou toque na cor que você está vendo:"
)

FOTO_INCERTA = (
    "🤔 <b>Não consegui ter certeza da cor na foto.</b>\n\n"
    "Para sua segurança, não vou chutar. Toque na cor que você está vendo na fitinha "
    "ou tire outra foto com boa luz, de perto:"
)

FOTO_ERRO = (
    "😕 <b>Não consegui abrir essa foto.</b>\n\n"
    "Toque na cor que você está vendo na fitinha:"
)

SECA = (
    "💧 <b>Quanta água o saco guarda pra seca?</b>\n\n"
    "• <b>1 saco cheio</b> = 13 litros de água em gel.\n"
    "• <b>15 sacos (Horta)</b> = 195 litros (quase 10 bombonas de 20L).\n"
    "• <b>80 sacos (Sítio)</b> = 1.040 litros (+18 dias sem precisar regar).\n\n"
    "👇 Toque abaixo para ver o gráfico da sua região:"
)

USAR = (
    "🌾 <b>Dúvidas comuns do produtor:</b>\n\n"
    "1️⃣ <b>Esse gel tem plástico ou veneno?</b>\n"
    "Não! É feito de mandioca/goma natural, casca de arroz e acácia negra. Vira adubo na terra.\n\n"
    "2️⃣ <b>O pano do saco some na terra?</b>\n"
    "Sim, o algodão cru apodrece sozinho em poucas semanas e alimenta as minhocas.\n\n"
    "3️⃣ <b>Quanto tempo dura fechado na chuva?</b>\n"
    "Segura a enxurrada por até 5 dias. Depois que a chuva passar, já corte e misture nos canteiros!"
)

RECEITA = (
    "🛠️ <b>Receita Caseira / Cooperativa (Para 1 saco de 1 kg):</b>\n\n"
    "• <b>700g (7 partes):</b> Casca de arroz + um punhado de carvão moído.\n"
    "• <b>250g (2 partes e meia):</b> Pó gelificante (goma xantana ou fécula).\n"
    "• <b>50g (meia parte):</b> Tanino de acácia + <i>Trichoderma</i>.\n\n"
    f"💰 <b>Custo:</b> Cerca de R$ {CUSTO_SACO_REAIS} por saco na cooperativa!"
)

FALLBACK = (
    "🤝 <b>Entendi sua pergunta, amigo(a)!</b>\n\n"
    "Para ficar bem fácil, escolha uma das opções abaixo ou me mande uma <b>foto do saco</b>:"
)

LAUDOS = {
    "verde": (
        "🟢 <b>SELO VERDE: ÁGUA BOA PRA ROÇA!</b>\n\n"
        "✅ <b>O que fazer:</b> Pode cortar o saco de algodão com a enxada e misturar o gel "
        "direto nos canteiros de verdura, milho ou feijão.\n\n"
        "💧 <b>Vantagem:</b> Cada saco guarda <b>13 litros de água</b> e já tem fungo bom "
        "(<i>Trichoderma</i>) que protege a raiz na estiagem."
    ),
    "amarelo": (
        "🟡 <b>SELO AMARELO: ÁGUA COM MUITO BARRO</b>\n\n"
        "⚠️ <b>O que fazer:</b> Não coloque em alface ou morango agora. Deixe esse saco descansar "
        "na <b>composteira por 15 dias</b> ou use apenas no pé de árvores frutíferas e acácia.\n\n"
        "🌡️ O calor do monte de adubo limpa a água antes de ir pra horta."
    ),
    "vermelho": (
        "🔴 <b>SELO VERMELHO: PERIGO - ÁGUA CONTAMINADA!</b>\n\n"
        "⛔ <b>O que fazer:</b> <b>PROIBIDO abrir na horta!</b> Essa água misturou com fossa ou óleo.\n\n"
        "🛡️ <b>Uso seguro:</b> Mantenha o saco fechado e use apenas para segurar barranco de "
        "estrada ou encosta. O carvão dentro dele prendeu a sujeira para proteger seu poço."
    ),
}
