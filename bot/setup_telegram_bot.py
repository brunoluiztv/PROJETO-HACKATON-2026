"""
Script de configuração direta do bot no Telegram via Bot API.

Configura automaticamente:
1. Comandos do bot (/start, /painel, /selo, /seca, /usar, /receita, /ajuda)
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
    print("⚠️  TELEGRAM_TOKEN NÃO ENCONTRADO OU PADRÃO")
    print("=" * 70)
    print("Para configurar seu bot no Telegram automaticamente:")
    print("1. Abra o Telegram e fale com @BotFather")
    print("2. Digite /newbot e siga as instruções para criar o bot")
    print("3. Copie o TOKEN gerado e cole no arquivo bot/.env:")
    print("   TELEGRAM_TOKEN=seu_token_aqui")
    print("4. Rode este script novamente: python setup_telegram_bot.py")
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
    print("🌱 AGROSPONGE RS — CONFIGURADOR TELEGRAM BOT API")
    print(f"🌐 WebApp HTTPS: {WEBAPP_URL}")
    print("=" * 70)

    # 1. Verificar bot
    me = api_call("getMe")
    if not me.get("ok"):
        print("❌ Token inválido ou sem resposta da API do Telegram.")
        sys.exit(1)

    bot_info = me["result"]
    bot_name = bot_info.get("first_name", "Bot")
    username = bot_info.get("username", "")
    print(f"✅ Conectado ao bot: {bot_name} (@{username})")

    # 2. Configurar lista de comandos
    comandos = [
        {"command": "start", "description": "🌱 Iniciar o Assistente AgroSponge RS"},
        {"command": "painel", "description": "📊 Abrir painel web e gráficos de estiagem"},
        {"command": "selo", "description": "📷 Analisar a cor do selo (Verde/Amarelo/Vermelho)"},
        {"command": "seca", "description": "💧 Calcular água guardada para a estiagem"},
        {"command": "usar", "description": "🌾 Como usar o saco de gel na terra"},
        {"command": "receita", "description": "🛠️ Receita do saco caseiro (R$ 5,80)"},
        {"command": "ajuda", "description": "❓ Dúvidas comuns e como falar com a equipe"},
    ]
    r_cmd = api_call("setMyCommands", {"commands": comandos})
    if r_cmd.get("ok"):
        print("✅ Comandos registrados com sucesso (/start, /painel, /selo, /seca, /usar, /receita, /ajuda).")

    # 3. Configurar descrição de boas-vindas (tela inicial antes de clicar em Start)
    descricao = (
        "🌱 AgroSponge RS — Assistente para a Agricultura Familiar\n"
        "⚡ Desenvolvido no Hackathon das Engenharias UERGS 2026\n\n"
        "Guarde a enxurrada e tenha água limpa na época de seca!\n\n"
        "✨ O que eu faço:\n"
        "• Leio a cor do selo do saco por foto ou áudio\n"
        "• Mostro se a água pode ir direto pra horta ou precisa compostagem\n"
        "• Calculo quantos dias sua horta aguenta sem rega (+18 dias)\n"
        "• Passo a receita do saco caseiro por R$ 5,80\n\n"
        "👇 Toque em Começar ou envie uma foto do selo!"
    )
    r_desc = api_call("setMyDescription", {"description": descricao})
    if r_desc.get("ok"):
        print("✅ Descrição inicial (apresentação) configurada.")

    # 4. Configurar bio / descrição curta
    bio = (
        "🌱 Assistente AgroSponge RS (Hackathon UERGS 2026): "
        "biossensor de enxurrada, guarda d'água e laudos para agricultura familiar."
    )
    r_short = api_call("setMyShortDescription", {"short_description": bio[:120]})
    if r_short.get("ok"):
        print("✅ Bio / Descrição curta configurada.")

    # 5. Configurar Botão de Menu WebApp (no canto inferior esquerdo do chat)
    menu_button = {
        "menu_button": {
            "type": "web_app",
            "text": "📊 Painel AgroSponge",
            "web_app": {"url": WEBAPP_URL}
        }
    }
    r_menu = api_call("setChatMenuButton", menu_button)
    if r_menu.get("ok"):
        print(f"✅ Botão Menu WebApp configurado apontando para {WEBAPP_URL}.")

    print("=" * 70)
    print("🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!")
    print(f"👉 Abra seu bot no Telegram: https://t.me/{username}")
    print("👉 Para subir o avatar oficial, envie a imagem:")
    print("   bot/assets/bot_avatar_hackathon.png")
    print("   ao @BotFather usando o comando /setuserpic")
    print("=" * 70)


if __name__ == "__main__":
    main()
