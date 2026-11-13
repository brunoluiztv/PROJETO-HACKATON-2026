"""
Tekó Biotech — Script de Provisionamento e Configuração do Bot Tekó no Telegram
Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural

Uso:
    python bot/configurar_teko.py --token <SEU_TOKEN_DO_BOTFATHER>
    ou simplesmente defina TELEGRAM_TOKEN no bot/.env e execute:
    python bot/configurar_teko.py
"""

import argparse
import os
import sys

_bot_dir = os.path.dirname(os.path.abspath(__file__))
if _bot_dir not in sys.path:
    sys.path.insert(0, _bot_dir)

import telebot
from telebot.types import BotCommand, MenuButtonWebApp, WebAppInfo
from dotenv import load_dotenv

NOME_BOT = "Tekó — Biossensor Sentinela"
SHORT_DESC = "Eu sou o Tekó, a voz da sua lavoura. Monitore a saúde da planta por dentro contra seca e enchente."
LONG_DESC = (
    "Ola! Eu sou o Teko, assistente fitoeletronico in-planta no RS.\n\n"
    "O biossensor na planta sentinela mede a agua no caule e o oxigenio da raiz:\n"
    "- Prevencao de estresse hidrico invisivel e taxa de secagem (Embrapa)\n"
    "- Alerta de enchente, asfixia radicular e Laudo PROAGRO\n"
    "- Economia de milhares de litros de agua e combustivel\n"
    "- Acessibilidade com botoes grandes e mensagens de audio\n\n"
    "Toque em Comecar para iniciar!"
)

COMANDOS_TEKO = [
    BotCommand("start", "Iniciar conversa com o Tekó (Menu Principal)"),
    BotCommand("planta", "Como está minha planta sentinela agora?"),
    BotCommand("bomba", "Preciso irrigar hoje? (Economia de água)"),
    BotCommand("previsao", "Previsão de secagem e estresse (Embrapa)"),
    BotCommand("solo", "Calibrar textura do solo do talhão"),
    BotCommand("duvidas", "Dúvidas sobre o clipe e a bateria")
]

DEFAULT_WEBAPP_URL = "https://brunoluiztv.github.io/PROJETO-HACKATON-2026/?v=21"


def provisionar_teko(token: str, webapp_url: str = DEFAULT_WEBAPP_URL) -> bool:
    if not token or token == "coloque_o_token_do_BotFather_aqui":
        print("❌ Erro: Token inválido ou não fornecido.")
        return False

    print("\n🌾 Conectando à API do Telegram com o Bot Tekó...")
    try:
        bot = telebot.TeleBot(token)
        me = bot.get_me()
        print(f"✅ Conectado com sucesso ao bot: @{me.username} (ID: {me.id})")

        # 1. Configura Foto de Perfil Oficial Tekó (se existir)
        avatar_path = os.path.join(_bot_dir, "assets", "teko_bot_avatar_512.png")
        if not os.path.exists(avatar_path):
            avatar_path = os.path.join(_bot_dir, "assets", "bot_avatar_hackathon.png")
        if os.path.exists(avatar_path):
            try:
                from telebot.types import InputProfilePhotoStatic
                with open(avatar_path, "rb") as f_img:
                    sucesso_foto = bot.set_my_profile_photo(InputProfilePhotoStatic(photo=f_img))
                    if sucesso_foto:
                        print(f"  • Foto de perfil oficial do Tekó atualizada no Telegram com sucesso.")
            except Exception as e:
                print(f"  ⚠️ Aviso ao definir foto de perfil: {e}")

        # 1. Configura Nome Público
        try:
            bot.set_my_name(NOME_BOT)
            print(f"  • Nome do Bot definido como: '{NOME_BOT}'")
        except Exception as e:
            print(f"  ⚠️ Aviso ao definir nome: {e}")

        # 2. Configura Descrição Curta (Bio)
        try:
            bot.set_my_short_description(SHORT_DESC)
            print("  • Descrição curta (Bio) atualizada.")
        except Exception as e:
            print(f"  ⚠️ Aviso ao definir short description: {e}")

        # 3. Configura Descrição Completa
        try:
            bot.set_my_description(LONG_DESC)
            print("  • Descrição completa (Sobre) atualizada.")
        except Exception as e:
            print(f"  ⚠️ Aviso ao definir descrição completa: {e}")

        # 4. Configura Comandos Oficiais
        try:
            bot.set_my_commands(COMANDOS_TEKO)
            print(f"  • {len(COMANDOS_TEKO)} comandos oficiais registrados no menu do Telegram.")
        except Exception as e:
            print(f"  ⚠️ Aviso ao definir comandos: {e}")

        # 5. Configura Menu Button (Telegram WebApp Anexo)
        try:
            bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    type="web_app",
                    text="📱 Painel Tekó",
                    web_app=WebAppInfo(url=webapp_url)
                )
            )
            print(f"  • Botão de Menu fixo vinculado ao WebApp: {webapp_url}")
        except Exception as e:
            print(f"  ⚠️ Aviso ao definir Menu Button: {e}")

        # 6. Grava arquivos .env
        salvar_arquivos_env(token, webapp_url)

        print("\n🎉 Tekó configurado com sucesso de ponta a ponta!")
        print(f"👉 Abra no celular: https://t.me/{me.username}")
        return True

    except Exception as err:
        print(f"❌ Falha de comunicação com o Telegram: {err}")
        return False


def salvar_arquivos_env(token: str, webapp_url: str):
    root_dir = os.path.abspath(os.path.join(_bot_dir, ".."))
    bot_env = os.path.join(_bot_dir, ".env")
    backend_env = os.path.join(root_dir, "backend", ".env")

    conteudo_bot = f"TELEGRAM_TOKEN={token}\nWEBAPP_URL={webapp_url}\n"
    with open(bot_env, "w", encoding="utf-8") as f:
        f.write(conteudo_bot)
    print(f"  • Arquivo {bot_env} gravado.")

    conteudo_backend = f"TELEGRAM_TOKEN={token}\nWEBAPP_URL={webapp_url}\n"
    with open(backend_env, "w", encoding="utf-8") as f:
        f.write(conteudo_backend)
    print(f"  • Arquivo {backend_env} gravado.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Configurador Automático do Bot Tekó")
    parser.add_argument("--token", help="HTTP API Token fornecido pelo @BotFather")
    parser.add_argument("--webapp", default=DEFAULT_WEBAPP_URL, help="URL pública do WebApp")
    args = parser.parse_args()

    load_dotenv(os.path.join(_bot_dir, ".env"))
    token = args.token or os.getenv("TELEGRAM_TOKEN")

    if not token or token.startswith("coloque_o_token"):
        divisor = "=" * 60
        print(divisor)
        print("          🌾 CONFIGURAÇÃO DO BOT TEKÓ NO TELEGRAM           ")
        print(divisor)
        print("Para concluir a ativação no Telegram:")
        print("1. Abra o Telegram e envie /newbot para o @BotFather")
        print("2. Nome do bot: Tekó — Tekó Biotech")
        print("3. Username: ex: TekoLavouraBot (deve terminar em bot)")
        print("4. Copie o token HTTP API gerado e passe como argumento:")
        print("   python bot/configurar_teko.py --token <TOKEN>")
        print(divisor)
        sys.exit(0)

    sucesso = provisionar_teko(token, args.webapp)
    if not sucesso:
        sys.exit(1)
