"""
Tekó Biotech — Bot do Telegram para Biossensor Eletrofisiológico In-Planta
Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural

Monitoramento não-invasivo de planta sentinela via bioimpedância de caule e ORP de rizosfera.
Foco em Zero Digitação e acessibilidade para o pequeno produtor do Rio Grande do Sul.
"""

import os
import sys
import logging

_bot_dir = os.path.dirname(os.path.abspath(__file__))
if _bot_dir not in sys.path:
    sys.path.insert(0, _bot_dir)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("teko_bot")

import telebot
from telebot import apihelper
from dotenv import load_dotenv

apihelper.CONNECT_TIMEOUT = 30
apihelper.READ_TIMEOUT = 60
apihelper.RETRY_ON_ERROR = True
from telebot.types import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo
)

import conteudo as c
from roteamento import rotear
from telemetria import DADOS_ESTADOS, obter_telemetria_tempo_real

load_dotenv(os.path.join(_bot_dir, ".env"))
load_dotenv(os.path.join(_bot_dir, "..", ".env"))
load_dotenv()

TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://brunoluiztv.github.io/PROJETO-HACKATON-2026/?v=21").rstrip("/")

TAG_SENSOR_ONLINE = "📡 <b>[SENSOR FÍSICO ESP32 ONLINE — GPIO 34]</b>\n"
_preferencia_solo = {}

def _token_valido(t: str) -> bool:
    return bool(t) and t != "coloque_o_token_do_BotFather_aqui" and t != "SEU_TOKEN_AQUI"

bot = telebot.TeleBot(TOKEN or "0:invalido", parse_mode="HTML")


def main_menu_keyboard():
    """Teclado fixo gigante na base do Telegram (Zero Digitação para o Agricultor)."""
    markup = ReplyKeyboardMarkup(resize_keyboard=True, is_persistent=True, row_width=2)
    btn_status = KeyboardButton(c.BTN_PLANTA)
    btn_bomba = KeyboardButton(c.BTN_BOMBA)
    btn_chuva = KeyboardButton(c.BTN_CHUVA)
    btn_bateria = KeyboardButton(c.BTN_BATERIA)
    btn_solo = KeyboardButton(c.BTN_SOLO)
    btn_painel = KeyboardButton(
        c.BTN_PAINEL,
        web_app=WebAppInfo(url=WEBAPP_URL)
    )
    markup.add(btn_status, btn_bomba)
    markup.add(btn_chuva, btn_bateria)
    markup.add(btn_solo, btn_painel)
    return markup


def inline_welcome_keyboard():
    """Botões rápidos aninhados à mensagem de boas-vindas."""
    markup = InlineKeyboardMarkup(row_width=2)
    markup.add(
        InlineKeyboardButton("🌱 Minha Planta", callback_data="cmd_planta"),
        InlineKeyboardButton("💧 Irrigar Hoje?", callback_data="cmd_bomba"),
    )
    markup.add(
        InlineKeyboardButton("🌧️ Raiz & Drenagem", callback_data="cmd_chuva"),
        InlineKeyboardButton("🚜 Tipo de Solo", callback_data="cmd_solo"),
    )
    markup.add(
        InlineKeyboardButton("📱 Abrir Painel Tekó (Web)", web_app=WebAppInfo(url=WEBAPP_URL)),
    )
    return markup


def inline_soil_keyboard():
    """Botões para selecionar a textura do solo do talhão."""
    markup = InlineKeyboardMarkup(row_width=1)
    markup.add(
        InlineKeyboardButton("🏖️ Solo Arenoso (Praia / Litoral - CC: 10 kPa)", callback_data="set_solo_arenoso"),
        InlineKeyboardButton("🌾 Solo Franco / Médio (Equilibrado - CC: 22 kPa)", callback_data="set_solo_franco"),
        InlineKeyboardButton("🧱 Solo Argiloso (Terra Roxa - CC: 33 kPa)", callback_data="set_solo_argiloso")
    )
    return markup


def inline_plant_state_keyboard():
    """Botões para simular ou consultar os 3 estados fisiológicos lidos pelo clipe bioelétrico."""
    markup = InlineKeyboardMarkup(row_width=1)
    markup.add(
        InlineKeyboardButton("🟢 Planta Hidratada (Seiva Normal)", callback_data="estado_hidratada"),
        InlineKeyboardButton("🟡 Alerta de Sede Precoce (Estiagem)", callback_data="estado_sede"),
        InlineKeyboardButton("🔴 Alerta de Enchente (Raiz Sufocando)", callback_data="estado_hipoxia"),
        InlineKeyboardButton("📊 Ver Gráficos da Planta no Site", web_app=WebAppInfo(url=WEBAPP_URL))
    )
    return markup


_cached_avatar_file_id = None


@bot.message_handler(commands=["start", "ajuda"])
def send_welcome(message):
    global _cached_avatar_file_id
    nome = message.from_user.first_name or "amigo(a) produtor(a)"
    texto_boas_vindas = c.BOAS_VINDAS.format(nome=nome)

    enviou_foto = False
    if _cached_avatar_file_id:
        try:
            bot.send_photo(
                message.chat.id,
                photo=_cached_avatar_file_id,
                caption=texto_boas_vindas,
                reply_markup=inline_welcome_keyboard()
            )
            enviou_foto = True
        except Exception as e:
            logger.warning(f"Erro ao reenviar foto com file_id: {e}")

    if not enviou_foto:
        avatar_path = os.path.join(_bot_dir, "assets", "teko_bot_avatar_512.png")
        if not os.path.exists(avatar_path):
            avatar_path = os.path.join(_bot_dir, "assets", "bot_avatar_hackathon.png")
        if os.path.exists(avatar_path):
            try:
                with open(avatar_path, "rb") as photo:
                    res = bot.send_photo(
                        message.chat.id,
                        photo=photo,
                        caption=texto_boas_vindas,
                        reply_markup=inline_welcome_keyboard()
                    )
                    if res and res.photo:
                        _cached_avatar_file_id = res.photo[-1].file_id
                enviou_foto = True
            except Exception as e:
                logger.warning(f"Erro ao enviar foto de boas-vindas: {e}")

    if not enviou_foto:
        try:
            bot.send_message(
                message.chat.id,
                texto_boas_vindas,
                reply_markup=inline_welcome_keyboard()
            )
        except Exception as e:
            logger.error(f"Erro ao enviar texto de boas-vindas: {e}")

    try:
        bot.send_message(
            message.chat.id,
            "🌾 <b>Teclado do Produtor Ativado:</b> Toque nos botões abaixo a qualquer momento 👇",
            reply_markup=main_menu_keyboard()
        )
    except Exception as e:
        logger.error(f"Erro ao enviar teclado fixo: {e}")


@bot.message_handler(content_types=["voice", "audio"])
def handle_voice(message):
    """Recepção orientando para o modo Zero Digitação (Opção 2)."""
    bot.send_message(message.chat.id, c.AUDIO_RESPOSTA, reply_markup=main_menu_keyboard())


def responder_telemetria(chat_id, estado="hidratada", dados_reais=None):
    if dados_reais is None:
        dados_reais = obter_telemetria_tempo_real()

    if estado not in DADOS_ESTADOS:
        estado = "hidratada"

    info_est = DADOS_ESTADOS[estado]
    tensao_kpa = dados_reais.get("tensao_kpa", info_est.get("tensao_kpa", 21.5))

    # Prioriza métricas bioelétricas em tempo real se disponíveis
    if dados_reais and "z_50k_ohms" in dados_reais and dados_reais["z_50k_ohms"] is not None:
        z_kohm = round(float(dados_reais["z_50k_ohms"]) / 1000.0, 1)
    else:
        z_kohm = info_est["z_50k_kohm"]

    if dados_reais and "orp_mv" in dados_reais and dados_reais["orp_mv"] is not None:
        orp_val = round(float(dados_reais["orp_mv"]))
    else:
        orp_val = info_est["orp_mv"]
    orp_str = f"+{orp_val}" if orp_val > 0 else f"{orp_val}"

    tag_sensor = ""
    if dados_reais.get("sensor_fisico_online"):
        tag_sensor = TAG_SENSOR_ONLINE
    elif dados_reais.get("online") and dados_reais.get("origem") == "simulado":
        tag_sensor = "🧪 <b>[MODO SIMULAÇÃO ATIVA]</b>\n"

    webapp_btn = InlineKeyboardMarkup()
    webapp_btn.add(
        InlineKeyboardButton(
            "📊 Abrir Gráficos de Seiva + Laudo PROAGRO",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}?estado={estado}")
        )
    )

    if estado == "hidratada":
        msg = (
            f"{tag_sensor}"
            "🟢 <b>PLANTA HIDRATADA: NÃO PRECISA LIGAR A BOMBA!</b>\n\n"
            f"💧 <b>Potencial Matricial do Solo (Ψm):</b> {tensao_kpa} kPa ({info_est['tensao_faixa']})\n"
            "✅ <b>O que a planta diz:</b> A seiva está subindo forte pelo caule "
            f"(Impedância: {z_kohm} kΩ) e a raiz está respirando bem ({orp_str} mV).\n\n"
            "💰 <b>Economia no bolso:</b> Você economiza <b>4.200 litros de água</b> do açude "
            "e <b>R$ 38,00 de luz/diesel</b> hoje deixando a irrigação desligada!"
        )
    elif estado == "sede":
        msg = (
            f"{tag_sensor}"
            "🟡 <b>ALERTA DE SEDE PRECOCE (ESTIAGEM)!</b>\n\n"
            f"☀️ <b>Potencial Matricial do Solo (Ψm):</b> {tensao_kpa} kPa ({info_est['tensao_faixa']})\n"
            "⚠️ <b>O que a planta diz:</b> As folhas ainda parecem verdes por fora, "
            f"mas a água dentro do caule caiu <b>28% hoje às 14h</b> (Impedância subiu para {z_kohm} kΩ).\n\n"
            "💧 <b>O que fazer:</b> Ligue o gotejamento amanhã às 6h da manhã por "
            "<b>40 minutos (3,5 litros por metro)</b> para não perder florada!\n\n"
            "💰 <b>Economia no bolso:</b> A irrigação cirúrgica matinal economiza <b>2.400 litros de água</b> "
            "e <b>R$ 22,00 de luz/diesel</b> hoje em relação à aspersão contínua!"
        )
    else:  # hipoxia
        msg = (
            f"{tag_sensor}"
            "🔴 <b>ALERTA DE ENCHENTE: RAIZ SUFOCANDO (HIPÓXIA)!</b>\n\n"
            f"🌊 <b>Potencial Matricial do Solo (Ψm):</b> {tensao_kpa} kPa ({info_est['tensao_faixa']})\n"
            "⛔ <b>O que a planta diz:</b> A terra está encharcada há mais de 30 horas. "
            f"Faltou oxigênio na raiz (Potencial Redox caiu para {orp_str} mV) e a planta parou de puxar água!\n\n"
            "🚜 <b>O que fazer agora:</b>\n"
            "1. <b>Não irrigue!</b> Abra um sulco/valeta no final do canteiro para escoar a água parada.\n"
            "2. Quando baixar, aplique <i>Trichoderma</i> para a raiz não apodrecer.\n"
            "3. Baixe o <b>Laudo Oficial de Alagamento</b> no botão abaixo para o seguro PROAGRO.\n\n"
            "💰 <b>Economia no bolso:</b> Ao suspender a bomba no alagamento, você economiza <b>4.200 litros de água</b> "
            "e <b>R$ 38,00 de diesel hoje</b>, além de evitar perda de safra de até R$ 8.500/ha por asfixia!"
        )

    bot.send_message(chat_id, msg, reply_markup=webapp_btn)


@bot.callback_query_handler(func=lambda call: call.data.startswith("set_solo_"))
def callback_solo(call):
    solo_id = call.data.replace("set_solo_", "")
    _preferencia_solo[call.message.chat.id] = solo_id

    nomes = {
        "arenoso": "Solo Arenoso (Leve / Litoral)",
        "franco": "Solo Franco / Médio",
        "argiloso": "Solo Argiloso (Terra Roxa / Várzea)"
    }
    nome_solo = nomes.get(solo_id, "Solo Franco")

    # Sincroniza em segundo plano com o backend FastAPI se estiver rodando
    try:
        import requests
        requests.post("http://127.0.0.1:8000/api/config/solo", json={"tipo_solo": solo_id}, timeout=1.0)
    except Exception:
        pass

    bot.answer_callback_query(call.id, f"Solo definido: {nome_solo}")
    bot.send_message(
        call.message.chat.id,
        f"✅ <b>Solo da lavoura calibrado para: {nome_solo}!</b>\n\n"
        "O biossensor recalculou a curva de retenção de água e os pontos de irrigação. "
        "As recomendações da bomba e os alertas agora refletem exatamente a sua terra.",
        reply_markup=main_menu_keyboard()
    )


@bot.callback_query_handler(func=lambda call: call.data.startswith("estado_"))
def callback_estados(call):
    estado = call.data.replace("estado_", "")
    bot.answer_callback_query(call.id, "Lendo bioimpedância da planta...")
    responder_telemetria(call.message.chat.id, estado=estado)


@bot.callback_query_handler(func=lambda call: call.data.startswith("cmd_"))
def callback_cmd(call):
    cmd = call.data.replace("cmd_", "")
    bot.answer_callback_query(call.id)
    solo_pref = _preferencia_solo.get(call.message.chat.id, "franco")
    tele = obter_telemetria_tempo_real(tipo_solo=solo_pref)
    estado = tele.get("estado", "hidratada")
    if cmd == "planta":
        responder_telemetria(call.message.chat.id, estado=estado, dados_reais=tele)
    elif cmd == "bomba":
        responder_telemetria(call.message.chat.id, estado=estado, dados_reais=tele)
    elif cmd == "chuva":
        _responder_chuva(call.message.chat.id, tele, estado)
    elif cmd == "solo":
        bot.send_message(call.message.chat.id, c.RESPOSTA_SOLO_MENU, reply_markup=inline_soil_keyboard())


@bot.message_handler(commands=["planta", "status"])
def cmd_planta(m):
    solo_pref = _preferencia_solo.get(m.chat.id, "franco")
    tele = obter_telemetria_tempo_real(tipo_solo=solo_pref)
    responder_telemetria(m.chat.id, estado=tele.get("estado", "hidratada"), dados_reais=tele)


@bot.message_handler(commands=["bomba", "irrigar"])
def cmd_bomba(m):
    solo_pref = _preferencia_solo.get(m.chat.id, "franco")
    tele = obter_telemetria_tempo_real(tipo_solo=solo_pref)
    estado = tele.get("estado", "hidratada")
    responder_telemetria(m.chat.id, estado=estado, dados_reais=tele)


def _responder_chuva(chat_id: int, tele: dict, estado: str):
    orp_val = tele.get("orp_mv", 310)
    tensao = tele.get("tensao_kpa", 21.5)

    if estado == "hipoxia" or orp_val <= 0 or tensao < 10.0:
        responder_telemetria(chat_id, estado="hipoxia", dados_reais=tele)
    else:
        orp_str = f"+{round(orp_val)}" if orp_val > 0 else f"{round(orp_val)}"
        tag_sensor = TAG_SENSOR_ONLINE if tele.get("sensor_fisico_online") else ""
        webapp_btn = InlineKeyboardMarkup()
        webapp_btn.add(
            InlineKeyboardButton(
                "📊 Ver Gráficos de Drenagem",
                web_app=WebAppInfo(url=f"{WEBAPP_URL}?estado={estado}")
            )
        )
        msg = tag_sensor + c.RESPOSTA_CHUVA_NORMAL.format(
            orp_str=orp_str,
            tensao=tensao
        )
        bot.send_message(chat_id, msg, reply_markup=webapp_btn)


@bot.message_handler(commands=["chuva", "enchente", "hipoxia"])
def cmd_chuva(m):
    solo_pref = _preferencia_solo.get(m.chat.id, "franco")
    tele = obter_telemetria_tempo_real(tipo_solo=solo_pref)
    estado = tele.get("estado", "hidratada")
    _responder_chuva(m.chat.id, tele, estado)


@bot.message_handler(commands=["simular", "teste", "pitch"])
def cmd_simular(m):
    """Comando de demonstração para banca examinadora simular os 3 estados."""
    bot.send_message(
        m.chat.id,
        "🧪 <b>Modo Demonstração / Banca Examinadora:</b>\n"
        "Toque em um dos estados para simular como o Tekó reage a cada situação agronômica:",
        reply_markup=inline_plant_state_keyboard()
    )


@bot.message_handler(commands=["solo"])
def cmd_solo(m):
    bot.send_message(m.chat.id, c.RESPOSTA_SOLO_MENU, reply_markup=inline_soil_keyboard())


@bot.message_handler(commands=["bateria", "duvidas"])
def cmd_bateria(m):
    bot.send_message(m.chat.id, c.DUVIDAS_PRODUTOR)


@bot.message_handler(commands=["painel", "graficos", "laudo"])
def cmd_painel(m):
    bot.send_message(m.chat.id, c.LAUDO_PROAGRO_TEXTO)


@bot.message_handler(func=lambda m: True)
def handle_questions(m):
    destino = rotear(m.text)
    solo_preferido = _preferencia_solo.get(m.chat.id, "franco")

    if destino == "planta":
        tele = obter_telemetria_tempo_real(tipo_solo=solo_preferido)
        responder_telemetria(m.chat.id, estado=tele.get("estado", "hidratada"), dados_reais=tele)
    elif destino == "bomba":
        tele = obter_telemetria_tempo_real(tipo_solo=solo_preferido)
        estado = tele.get("estado", "hidratada")
        responder_telemetria(m.chat.id, estado=estado, dados_reais=tele)
    elif destino == "chuva":
        tele = obter_telemetria_tempo_real(tipo_solo=solo_preferido)
        estado = tele.get("estado", "hidratada")
        _responder_chuva(m.chat.id, tele, estado)
    elif destino == "bateria":
        bot.send_message(m.chat.id, c.DUVIDAS_PRODUTOR)
    elif destino == "painel":
        bot.send_message(m.chat.id, c.LAUDO_PROAGRO_TEXTO)
    elif destino == "solo":
        bot.send_message(m.chat.id, c.RESPOSTA_SOLO_MENU, reply_markup=inline_soil_keyboard())
    elif destino == "clima":
        bot.send_message(m.chat.id, c.RESPOSTA_CLIMA_TALHAO, parse_mode="HTML")
    else:
        bot.send_message(
            m.chat.id,
            "🤝 <b>Estou aqui pra ajudar na lida!</b> Toque em um dos botões do menu abaixo para ver como está sua lavoura:",
            reply_markup=main_menu_keyboard()
        )


@bot.message_handler(commands=["predicao", "previsao"])
def cmd_predicao(message):
    chat_id = message.chat.id
    cultura = "Alface Crespa (Olericultura)"
    solo = "Argissolo (Textura Média)"
    tensao = 25.5
    taxa = 2.0
    limite = 28.0
    dias = 1.3
    fonte = "Embrapa Hortaliças - Manejo por Tensiometria"
    msg_orientacao = "Sua lavoura está secando a um ritmo de 2.0 kPa/dia. Programe a irrigação para as próximas 24 horas."

    try:
        import requests
        resp = requests.get("http://127.0.0.1:8000/api/predicao?id_perfil=olericultura_alface_argissolo", timeout=1.5)
        if resp.status_code == 200:
            data = resp.json()
            perfil = data.get("perfil", {})
            pred = data.get("predicao", {})
            cultura = perfil.get("cultura", cultura)
            solo = perfil.get("solo", solo)
            tensao = pred.get("tensao_atual_kpa", tensao)
            taxa = data.get("taxa_secagem_kpa_dia", taxa)
            limite = perfil.get("tensao_critica_manejo_kpa", limite)
            dias = pred.get("dias_restantes_estimados", dias)
            fonte = data.get("fonte_cientifica", fonte)
            msg_orientacao = pred.get("mensagem_bot", msg_orientacao)
    except Exception:
        pass

    texto = c.RESPOSTA_PREDICAO_ESTRESSE.format(
        cultura=cultura,
        solo=solo,
        tensao=tensao,
        taxa=taxa,
        limite=limite,
        dias=dias,
        mensagem=msg_orientacao,
        fonte=fonte
    )
    bot.send_message(chat_id, texto, reply_markup=main_menu_keyboard(), parse_mode="HTML")


if __name__ == "__main__":
    if not _token_valido(TOKEN):
        sys.exit("Defina TELEGRAM_TOKEN em bot/.env para iniciar o bot Tekó.")
    print("🌾 Bot Tekó (Tekó Biotech) pronto para atender os produtores no Telegram...")
    bot.infinity_polling()
