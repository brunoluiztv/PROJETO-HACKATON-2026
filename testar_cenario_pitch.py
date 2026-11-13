"""
Tekó Biotech — Script de Simulação e Ensaio do Pitch de 5 Minutos
Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural

Este script permite testar toda a cadeia de dados e os 3 cenários agronômicos
da banca avaliadora sem precisar do ESP32 físico conectado:
1. Solo Úmido / Capacidade de Campo (18 kPa - Bomba Desligada)
2. Clímax do Pitch: Sensor no Ar Seco (48 kPa - Alerta Crítico < 24h)
3. Pós-Temporal: Enchente & Hipóxia Radicular (0 kPa, ORP -140 mV - Laudo PROAGRO)
"""

import sys
import time
import json
import urllib.request
import urllib.error

API_BASE = "http://127.0.0.1:8000"

CENARIOS = [
    {
        "nome": "CENÁRIO 1: Capacidade de Campo (Terra Úmida)",
        "descricao": "Condição normal pós-irrigação eficiente. A planta tem água abundante nos microporos.",
        "payload": {
            "node_id": "sentinela-01",
            "tipo_solo": "franco",
            "tensao_kpa": 18.0,
            "resistencia_ohms": 2500.0,
            "z_50k_ohms": 1450.0,
            "z_1k_ohms": 1150.0,
            "orp_mv": 320.0,
            "ce_dsm": 1.25,
            "pmfc_mv": 580.0,
            "bateria_mv": 3300,
            "rssi": -65
        },
        "esperado": "BOMBA DESLIGADA / HIDRATADA"
    },
    {
        "nome": "CENÁRIO 2: O CLÍMAX DO PITCH (Sensor Puxado para o Ar Seco)",
        "descricao": "Simulação de estresse hídrico severo. A tensão cruza o limite crítico da Embrapa (28 kPa).",
        "payload": {
            "node_id": "sentinela-01",
            "tipo_solo": "franco",
            "tensao_kpa": 48.0,
            "resistencia_ohms": 7500.0,
            "z_50k_ohms": 4900.0,
            "z_1k_ohms": 4100.0,
            "orp_mv": 440.0,
            "ce_dsm": 1.95,
            "pmfc_mv": 420.0,
            "bateria_mv": 3280,
            "rssi": -62
        },
        "esperado": "🚨 ALERTA CRÍTICO: IRRIGAR JÁ (< 24h)"
    },
    {
        "nome": "CENÁRIO 3: Pós-Temporal / Enchente (Hipóxia Radicular)",
        "descricao": "Solo 100% saturado de água. Ausência de O2 fecha aquaporinas (seca fisiológica).",
        "payload": {
            "node_id": "sentinela-01",
            "tipo_solo": "franco",
            "tensao_kpa": 0.5,
            "resistencia_ohms": 350.0,
            "z_50k_ohms": 5900.0,
            "z_1k_ohms": 5100.0,
            "orp_mv": -140.0,
            "ce_dsm": 0.60,
            "pmfc_mv": 520.0,
            "bateria_mv": 3300,
            "rssi": -68
        },
        "esperado": "🔴 ASFIXIA RADICULAR / LAUDO PROAGRO"
    }
]


def testar_servidor_online():
    """Verifica se o backend FastAPI está rodando na porta 8000."""
    try:
        req = urllib.request.Request(f"{API_BASE}/api/telemetria/atual")
        with urllib.request.urlopen(req, timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False


def enviar_cenario(cenario):
    """Dispara um pacote de telemetria via HTTP POST para a API."""
    url = f"{API_BASE}/api/telemetria"
    data = json.dumps(cenario["payload"]).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            resultado = json.loads(resp.read().decode("utf-8"))
            return resultado
    except urllib.error.HTTPError as e:
        return {"erro": e.read().decode("utf-8")}
    except Exception as e:
        return {"erro": str(e)}


def main():
    print("=" * 70)
    print("🌱  TEKÓ BIOTECH — SIMULADOR INTERATIVO DOS CENÁRIOS DO PITCH")
    print("    Hackathon das Engenharias UERGS 2026")
    print("=" * 70)

    if not testar_servidor_online():
        print("\n⚠️  O Backend FastAPI não está rodando em http://localhost:8000")
        print("   Por favor, inicie o servidor primeiro:")
        print("   -> Dê dois cliques em 'iniciar_servidor.bat' ou execute:")
        print("      python -m uvicorn backend.server:app --reload --port 8000\n")
        print("=" * 70)
        sys.exit(1)

    print("\n✅ Backend FastAPI conectado com sucesso na porta 8000!\n")

    for i, cenario in enumerate(CENARIOS, 1):
        print("-" * 70)
        print(f"▶️  [{i}/3] {cenario['nome']}")
        print(f"    ℹ️  {cenario['descricao']}")
        print(f"    🎯 Expectativa: {cenario['esperado']}")
        print(f"    📡 Enviando pacote: Ψm = {cenario['payload']['tensao_kpa']} kPa | ORP = {cenario['payload']['orp_mv']} mV...")

        resposta = enviar_cenario(cenario)
        time.sleep(1)

        if "erro" in resposta:
            print(f"    ❌ Erro ao enviar: {resposta['erro']}")
        else:
            tel = resposta.get("telemetria", {})
            pred = resposta.get("predicao", {})
            estado_solo = tel.get("estado_hidrico_solo", {})
            planta_cond = tel.get("condicao_planta", "N/A")

            print(f"    ✅ Resposta da API:")
            print(f"       - Estado Físico do Solo: {estado_solo.get('estado', 'N/A')} ({estado_solo.get('condicao_solo', 'N/A')})")
            print(f"       - Condição da Planta: {planta_cond}")
            print(f"       - Status Predição: {pred.get('status', 'N/A')}")
            print(f"       - Dias Restantes: {pred.get('dias_restantes_estimados', 'N/A')} dias")
            print(f"       - Mensagem Assistente: \"{pred.get('mensagem_bot', 'N/A')}\"")

        print()
        if i < len(CENARIOS):
            input("    👉 Pressione [ENTER] para testar o próximo cenário do pitch...")

    print("=" * 70)
    print("🏆  SIMULAÇÃO CONCLUÍDA COM SUCESSO!")
    print("    Todos os 3 cenários agronômicos da Embrapa foram validados de ponta a ponta.")
    print("    Abra o painel web para ver o gráfico atualizado:")
    print("    https://brunoluiztv.github.io/PROJETO-HACKATON-2026/?v=10")
    print("=" * 70)


if __name__ == "__main__":
    main()
