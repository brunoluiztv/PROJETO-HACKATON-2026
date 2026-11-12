"""
AgroSponge RS - Bot do Telegram para Agricultura Familiar (Hackathon das Engenharias UERGS)

Como rodar:
1. Crie um bot no @BotFather do Telegram e copie o TOKEN.
2. Copie .env.example para .env e preencha TELEGRAM_TOKEN (ou defina a variável de ambiente).
3. Hospede a pasta web/ (Netlify/GitHub Pages, HTTPS) e coloque a URL em WEBAPP_URL.
4. pip install -r requirements.txt  &&  python agrosponge_telegram_bot.py
"""

import os
import sys

import telebot
from dotenv import load_dotenv
from telebot.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)

import conteudo as c
from classificador import classificar_cor
from roteamento import rotear

load_dotenv()

TOKEN = os.getenv("TELEGRAM_TOKEN", "")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://agrosponge-rs-uergs.netlify.app").rstrip("/")


def _token_valido(token: str) -> bool:
    return bool(token) and token != "SEU_TOKEN_AQUI"


bot = telebot.TeleBot(TOKEN or "0:invalido", parse_mode="HTML")


def main_menu_keyboard():
    """Teclado fixo gigante na parte inferior do Telegram (reconhecimento em vez de memorização)."""
    markup = ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    markup.add(KeyboardButton(c.BTN_FOTO), KeyboardButton(c.BTN_SECA))
    markup.add(KeyboardButton(c.BTN_USAR), KeyboardButton(c.BTN_RECEITA))
    markup.add(KeyboardButton(c.BTN_PAINEL, web_app=WebAppInfo(url=WEBAPP_URL)))
    return markup


def inline_color_keyboard():
    """Botões rápidos caso o agricultor não queira/consiga tirar foto."""
    markup = InlineKeyboardMarkup(row_width=1)
    markup.add(
        InlineKeyboardButton("🟢 Ficou VERDE (Água limpa)", callback_data="cor_verde"),
        InlineKeyboardButton("🟡 Ficou AMARELO (Com barro)", callback_data="cor_amarelo"),
        InlineKeyboardButton("🔴 Ficou VERMELHO (Água suja/fossa)", callback_data="cor_vermelho"),
        InlineKeyboardButton(
            "📊 Ver Gráficos Completos no Site", web_app=WebAppInfo(url=WEBAPP_URL)
        ),
    )
    return markup


@bot.message_handler(commands=["start", "ajuda"])
def send_welcome(message):
    nome = message.from_user.first_name or "amigo(a) produtor(a)"
    bot.send_message(
        message.chat.id, c.BOAS_VINDAS.format(nome=nome), reply_markup=main_menu_keyboard()
    )


@bot.message_handler(content_types=["voice", "audio"])
def handle_voice(message):
    """Recepção acolhedora quando o agricultor manda áudio em vez de digitar."""
    bot.send_message(message.chat.id, c.AUDIO, reply_markup=inline_color_keyboard())


@bot.message_handler(content_types=["photo"])
def handle_photo(message):
    """Lê automaticamente o RGB médio do centro da foto enviada pelo agricultor."""
    try:
        file_info = bot.get_file(message.photo[-1].file_id)
        dados = bot.download_file(file_info.file_path)
        cor = classificar_cor(dados)
    except Exception:
        bot.send_message(message.chat.id, c.FOTO_ERRO, reply_markup=inline_color_keyboard())
        return

    if cor is None:
        bot.send_message(message.chat.id, c.FOTO_INCERTA, reply_markup=inline_color_keyboard())
    else:
        responder_laudo(message.chat.id, cor)


def responder_laudo(chat_id, cor):
    """Respostas sintéticas, acolhedoras e sem jargão difícil."""
    webapp_btn = InlineKeyboardMarkup()
    webapp_btn.add(
        InlineKeyboardButton(
            "📊 Abrir Laudo Técnico + Gráficos da Propriedade",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/?lote={cor}"),
        )
    )
    bot.send_message(chat_id, c.LAUDOS[cor], reply_markup=webapp_btn)


@bot.callback_query_handler(func=lambda call: call.data.startswith("cor_"))
def callback_cores(call):
    cor = call.data.replace("cor_", "")
    if cor not in c.LAUDOS:
        bot.answer_callback_query(call.id)
        return
    bot.answer_callback_query(call.id, "Analisando o selo do seu saco...")
    responder_laudo(call.message.chat.id, cor)


@bot.message_handler(func=lambda m: True, content_types=["text", "sticker", "video", "document"])
def handle_text_questions(m):
    assunto = rotear(getattr(m, "text", None))
    chat = m.chat.id

    if assunto == "foto":
        bot.send_message(chat, c.PEDIR_FOTO, reply_markup=inline_color_keyboard())
    elif assunto == "seca":
        markup = InlineKeyboardMarkup()
        markup.add(
            InlineKeyboardButton(
                "📈 Simular Minha Lavoura no Gráfico",
                web_app=WebAppInfo(url=f"{WEBAPP_URL}/#graficos"),
            )
        )
        bot.send_message(chat, c.SECA, reply_markup=markup)
    elif assunto == "usar":
        bot.send_message(chat, c.USAR)
    elif assunto == "receita":
        bot.send_message(chat, c.RECEITA)
    else:
        # Fallback empático para qualquer mensagem do agricultor
        bot.send_message(chat, c.FALLBACK, reply_markup=inline_color_keyboard())


if __name__ == "__main__":
    if not _token_valido(TOKEN):
        sys.exit("Defina TELEGRAM_TOKEN (veja .env.example). Crie o token no @BotFather.")
    print("Bot AgroSponge RS rodando no Telegram...")
    bot.infinity_polling()
