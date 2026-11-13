"""
Script de configuração direta do bot Tekó Biotech via Telegram Bot API.

Configura automaticamente:
1. Comandos (/start, /painel, /planta, /irrigar, /chuva, /energia, /laudo, /ajuda)
2. Descrição na tela de início (setMyDescription)
3. Descrição curta / Bio (setMyShortDescription)
4. Botão Menu WebApp (setChatMenuButton) com link HTTPS do GitHub Pages

Como usar:
1. Cole seu token em bot/.env (TELEGRAM_TOKEN=123456:ABC-DEF...)
2. Execute: python setup_telegram_bot.py
"""

import json
import os
import sys
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://brunoluiztv.github.io/PROJETO-HACKATON-2026").rstrip("/")

if not TOKEN or TOKEN == "coloque_o_token_do_BotFather_aqui":
    print("=" * 70)
    print("⚠️  TELEGRAM_TOKEN NÃO ENCONTRADO")
    print("=" * 70)
    print("1. Crie seu bot no @BotFather do Telegram (/newbot)")
    print("2. Cole o token gerado em bot/.env:")
    print("   TELEGRAM_TOKEN=seu_token_aqui")
    print("3. Execute novamente: python setup_telegram_bot.py")
    print("=" * 70)
    sys.exit(1)

API_BASE = f"https://api.telegram.org/bot{TOKEN}"


def api_call(method: str, data: dict = None) -> dict:
    url = f"{API_BASE}/{method}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        print(f"❌ Erro na chamada {method}: {err}")
        return {"ok": False, "description": err}
    except Exception as e:
        print(f"❌ Erro de conexão em {method}: {e}")
        return {"ok": False, "description": str(e)}


def main():
    print("=" * 70)
    print("🌱 TEKÓ BIOTECH — CONFIGURADOR TELEGRAM BOT API")
    print(f"🌐 WebApp HTTPS: {WEBAPP_URL}")
    print("=" * 70)

    me = api_call("getMe")
    if not me.get("ok"):
        print("❌ Token inválido ou sem resposta da API do Telegram.")
        sys.exit(1)

    bot_info = me["result"]
    bot_name = bot_info.get("first_name", "Bot")
    username = bot_info.get("username", "")
    print(f"✅ Conectado ao bot: {bot_name} (@{username})")

    # 1. Comandos
    comandos = [
        {"command": "start", "description": "🌱 Iniciar o Assistente Tekó (Tekó Biotech)"},
        {"command": "painel", "description": "📊 Abrir Gráficos da Planta e Laudo PROAGRO"},
        {"command": "planta", "description": "🌿 Ver saúde fitoelétrica da Planta Sentinela"},
        {"command": "irrigar", "description": "💧 Saber se precisa ligar a bomba hoje"},
        {"command": "chuva", "description": "🌧️ Diagnóstico de alagamento e oxigênio da raiz"},
        {"command": "energia", "description": "🔋 Bateria e autossuficiência P-MFC"},
        {"command": "laudo", "description": "📄 Laudo de Enchente para Seguro PROAGRO"},
        {"command": "ajuda", "description": "❓ Como funciona o biossensor de caule"},
    ]
    r_cmd = api_call("setMyCommands", {"commands": comandos})
    if r_cmd.get("ok"):
        print("✅ Comandos registrados com sucesso (/start, /painel, /planta, /irrigar, /chuva, /energia, /laudo, /ajuda).")

    # 2. Descrição na tela inicial
    descricao = (
        "🌱 Tekó Biotech — Biossensor Eletrofisiológico In-Planta\n"
        "⚡ Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem\n\n"
        "A voz da sua lavoura na palma da mão!\n\n"
        "✨ O que o sensor faz:\n"
        "• Clipe de caule mede seiva e turgor celular (1k e 50 kHz)\n"
        "• Haste na raiz detecta sufocamento por enchente (ORP < -100 mV)\n"
        "• Economiza até 4.200 L de água e R$ 38 de luz/diesel por dia\n"
        "• Gera laudo técnico para acionamento do seguro PROAGRO\n"
        "• Energia limpa colhida de bactérias da terra (P-MFC) + solar\n\n"
        "👇 Toque em Começar para falar com seu sensor sentinela!"
    )
    r_desc = api_call("setMyDescription", {"description": descricao})
    if r_desc.get("ok"):
        print("✅ Descrição de apresentação configurada.")

    # 3. Bio / Descrição curta
    bio = (
        "🌱 Tekó Biotech (UERGS 2026): biossensor no caule e raiz com laudos PROAGRO e economia de água para o agricultor."
    )
    r_short = api_call("setMyShortDescription", {"short_description": bio[:120]})
    if r_short.get("ok"):
        print("✅ Bio / Descrição curta configurada.")

    # 4. Botão Menu WebApp
    menu_button = {
        "menu_button": {
            "type": "web_app",
            "text": "📊 Painel Tekó",
            "web_app": {"url": WEBAPP_URL}
        }
    }
    r_menu = api_call("setChatMenuButton", menu_button)
    if r_menu.get("ok"):
        print(f"✅ Botão Menu WebApp configurado apontando para {WEBAPP_URL}.")

    print("=" * 70)
    print("🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!")
    print(f"👉 Abra seu bot no Telegram: https://t.me/{username}")
    print("👉 Envie o avatar oficial no @BotFather com /setuserpic:")
    print("   bot/assets/bot_avatar_hackathon.png")
    print("=" * 70)


if __name__ == "__main__":
    main()
