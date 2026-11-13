"""
Suíte de Testes Automatizados da API FastAPI da Tekó Biotech
Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural
"""

import os
import sys
import asyncio
import pytest
from pydantic import ValidationError

# Adiciona o diretório raiz do projeto ao sys.path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT_DIR)

from backend.server import (
    app,
    raiz,
    health,
    receber_telemetria,
    obter_telemetria_atual,
    obter_historico_telemetria,
    simular_telemetria,
    definir_tipo_solo,
    obter_config_solo,
    classificar_estado_agronomico,
    calcular_agua_disponivel_pct,
    enriquecer_telemetria,
    TelemetriaIn,
    ConfigSoloIn,
    SimularIn,
    CONFIG_SOLOS
)
from fastapi import BackgroundTasks, HTTPException


def test_health_check():
    data = health()
    assert data["status"] == "ok"
    assert "uptime_segundos" in data
    assert "leituras_processadas" in data
    assert isinstance(data["uptime_segundos"], (int, float))


def test_raiz_metadata():
    data = raiz()
    assert "Tekó Biotech" in data["sistema"]
    assert len(data["endpoints"]) >= 4


def test_classificacao_agronomica_faixas():
    # Hipóxia por saturação hídrica (< 10 kPa no solo franco)
    assert classificar_estado_agronomico(5.0, 200.0, "franco") == "hipoxia"
    assert classificar_estado_agronomico(0.0, 300.0, "franco") == "hipoxia"

    # Hipóxia por anóxia radicular (ORP < -100 mV) mesmo com tensão moderada
    assert classificar_estado_agronomico(20.0, -140.0, "franco") == "hipoxia"
    assert classificar_estado_agronomico(15.0, -105.0, "franco") == "hipoxia"

    # Hidratada / Capacidade de Campo no solo franco (22 kPa)
    assert classificar_estado_agronomico(15.0, 310.0, "franco") == "hidratada"
    assert classificar_estado_agronomico(22.5, 320.0, "franco") == "hidratada"
    assert classificar_estado_agronomico(30.0, 310.0, "franco") == "hidratada"

    # Sede / Estresse Hídrico no solo franco (> 45 kPa)
    assert classificar_estado_agronomico(46.0, 420.0, "franco") == "sede"
    assert classificar_estado_agronomico(75.0, 480.0, "franco") == "sede"


def test_diferenciacao_agronomica_por_tipo_de_solo():
    """
    PROVA DE CONCEITO DA TABELA AGRONÔMICA:
    Uma mesma tensão matricial (ex: 35 kPa) representa realidades opostas
    dependendo da textura do solo do produtor rural:
    - No solo Arenoso (CC 10 kPa, Estresse 30 kPa): 35 kPa é SEDE / ESTRESSE!
    - No solo Argiloso (CC 33 kPa, Estresse 65 kPa): 35 kPa é HIDRATADA / PLENA ÁGUA!
    """
    tensao_teste = 35.0

    estado_arenoso = classificar_estado_agronomico(tensao_teste, 310.0, tipo_solo="arenoso")
    estado_argiloso = classificar_estado_agronomico(tensao_teste, 310.0, tipo_solo="argiloso")

    assert estado_arenoso == "sede", "Em 35 kPa o solo arenoso já está em estresse hídrico!"
    assert estado_argiloso == "hidratada", "Em 35 kPa o solo argiloso ainda está na capacidade de campo!"

    # Água Disponível (AD %):
    ad_arenoso = calcular_agua_disponivel_pct(tensao_teste, "arenoso")
    ad_argiloso = calcular_agua_disponivel_pct(tensao_teste, "argiloso")
    assert ad_argiloso > ad_arenoso, "Solo argiloso deve reter mais água disponível em 35 kPa do que arenoso!"


def test_endpoint_config_solo():
    # 1. Consulta solos disponíveis
    cfg = obter_config_solo()
    assert "solo_ativo" in cfg
    assert "arenoso" in cfg["solos_disponiveis"]
    assert "argiloso" in cfg["solos_disponiveis"]

    # 2. Altera para solo arenoso
    res = definir_tipo_solo(ConfigSoloIn(tipo_solo="arenoso"))
    assert res["sucesso"] is True
    assert res["solo_ativo"] == "arenoso"

    # 3. Altera para solo argiloso
    res2 = definir_tipo_solo(ConfigSoloIn(tipo_solo="argiloso"))
    assert res2["sucesso"] is True
    assert res2["solo_ativo"] == "argiloso"

    # 4. Rejeita solo inválido
    with pytest.raises(HTTPException):
        definir_tipo_solo(ConfigSoloIn(tipo_solo="solo_invalido_xyz"))

    # Restaura para franco
    definir_tipo_solo(ConfigSoloIn(tipo_solo="franco"))


def test_post_telemetria_hidratada():
    dado = TelemetriaIn(
        node_id="sentinela-01",
        tensao_kpa=21.5,
        resistencia_ohms=2150.0,
        z_50k_ohms=1420.0,
        z_1k_ohms=980.0,
        orp_mv=310.0,
        ce_dsm=1.45,
        pmfc_mv=520.0,
        bateria_mv=3300,
        rssi=-58
    )
    bg = BackgroundTasks()
    res = receber_telemetria(dado, bg)
    assert res["sucesso"] is True
    reg = res["registro"]
    assert reg["node_id"] == "sentinela-01"
    assert reg["estado"] == "hidratada"
    assert "DESLIGADA" in reg["status_bomba"]
    assert reg["tensao_kpa"] == 21.5


def test_post_telemetria_hipoxia():
    dado = TelemetriaIn(
        node_id="sentinela-01",
        tensao_kpa=4.2,
        resistencia_ohms=450.0,
        orp_mv=-140.0
    )
    bg = BackgroundTasks()
    res = receber_telemetria(dado, bg)
    assert res["sucesso"] is True
    reg = res["registro"]
    assert reg["estado"] == "hipoxia"
    assert "NÃO LIGAR" in reg["status_bomba"]
    assert reg["alerta_ativo"] is True
    # Verifica correlação fisiológica preenchida automaticamente
    assert reg["z_50k_ohms"] == 5900.0


def test_post_telemetria_sede_severa():
    dado = TelemetriaIn(
        node_id="sentinela-01",
        tensao_kpa=68.0
    )
    bg = BackgroundTasks()
    res = receber_telemetria(dado, bg)
    assert res["sucesso"] is True
    reg = res["registro"]
    assert reg["estado"] == "sede"
    assert reg["alerta_ativo"] is True
    assert "06H" in reg["status_bomba"]


def test_post_telemetria_validacao_limites():
    # Tensão negativa inválida
    with pytest.raises(ValidationError):
        TelemetriaIn(tensao_kpa=-5.0)

    # Tensão acima do limite de 250 kPa
    with pytest.raises(ValidationError):
        TelemetriaIn(tensao_kpa=999.0)


def test_get_telemetria_atual():
    # Envia leitura física
    dado = TelemetriaIn(node_id="sentinela-teste-atual", tensao_kpa=18.0)
    bg = BackgroundTasks()
    receber_telemetria(dado, bg)

    atual = obter_telemetria_atual()
    assert atual["node_id"] == "sentinela-teste-atual"
    assert atual["tensao_kpa"] == 18.0
    assert atual["estado"] == "hidratada"
    assert "segundos_desde_leitura" in atual
    assert atual["sensor_fisico_online"] is True


def test_get_historico_telemetria():
    # Garante que há pelo menos uma medição injetada
    receber_telemetria(TelemetriaIn(node_id="sentinela-hist", tensao_kpa=22.0), BackgroundTasks())
    data = obter_historico_telemetria()
    assert "total" in data
    assert "leituras" in data
    assert isinstance(data["leituras"], list)
    assert data["total"] >= 1


def test_simular_telemetria():
    sim_payload = SimularIn(
        estado="hipoxia",
        node_id="sentinela-sim-palco"
    )
    res = simular_telemetria(sim_payload)
    assert res["sucesso"] is True
    reg = res["registro"]
    assert reg["estado"] == "hipoxia"
    assert reg["node_id"] == "sentinela-sim-palco"
    assert reg["fonte"] == "simulado"


def test_expiracao_sensor_fisico_e_fallback_simulacao():
    import backend.server as srv
    import time

    # 1. Injeta telemetria física no passado (> 30s)
    bg = BackgroundTasks()
    res = receber_telemetria(TelemetriaIn(node_id="sentinela-antiga", tensao_kpa=25.0), bg)
    srv._ultima_leitura_fisica["timestamp_unix"] = time.time() - 40.0

    # 2. Injeta telemetria simulada recente
    sim_res = simular_telemetria(SimularIn(estado="hipoxia", node_id="sim-palco-ativo"))
    assert sim_res["sucesso"] is True

    # 3. Consulta telemetria atual: com sensor físico expirado, deve retornar a simulação ativa
    atual = obter_telemetria_atual()
    assert atual["sensor_fisico_online"] is False
    assert atual["fonte"] == "simulado"
    assert atual["estado"] == "hipoxia"
    assert atual["node_id"] == "sim-palco-ativo"


def test_despachar_alerta_sem_bloqueio():
    from backend.server import despachar_alerta_telegram_se_necessario
    # Teste de robustez: sem token ou com token nulo, função deve encerrar silenciosamente sem erro
    registro_alerta = {
        "node_id": "sentinela-teste",
        "estado": "hipoxia",
        "tensao_kpa": 4.5,
        "orp_mv": -140.0,
        "z_50k_ohms": 5900.0
    }
    # Não deve lançar exceção
    despachar_alerta_telegram_se_necessario(registro_alerta)


def test_zero_termos_antigos_em_backend():
    termos_proibidos = ["saco biodegradavel", "sacos biodegradáveis", "casca de arroz", "agrosponge"]
    server_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server.py"))

    with open(server_path, "r", encoding="utf-8") as f:
        texto = f.read().lower()
        for t in termos_proibidos:
            assert t not in texto, f"Termo proibido encontrado em server.py: {t}"


def test_conversao_adc_para_kpa_simulado():
    from backend.motor_predicao import adc_para_kpa_simulado
    # 1. Submerso em terra molhada (1200 ou menos -> 10.0 kPa)
    assert adc_para_kpa_simulado(1200) == 10.0
    assert adc_para_kpa_simulado(500) == 10.0

    # 2. Ar seco (4095 -> 80.0 kPa)
    assert adc_para_kpa_simulado(4095) == 80.0

    # 3. Intermediário
    kpa_meio = adc_para_kpa_simulado(2647)
    assert 40.0 <= kpa_meio <= 50.0


def test_motor_predicao_taxa_secagem_e_dias_estresse():
    from backend.motor_predicao import calcular_taxa_secagem, prever_estresse_hidrico

    # 1. Taxa de secagem com série temporal simulada
    leituras_teste = [
        {"tensao_kpa": 14.0},
        {"tensao_kpa": 16.0},
        {"tensao_kpa": 18.0},
        {"tensao_kpa": 20.0},
        {"tensao_kpa": 22.0}
    ]
    taxa = calcular_taxa_secagem(leituras_teste)
    assert taxa == 2.0, "Taxa deve ser exatos 2.0 kPa/dia ((22 - 14) / 4)"

    # 2. Predição com dias restantes > 3 (Ideal)
    pred_ideal = prever_estresse_hidrico(
        tensao_atual_kpa=22.0,
        tensao_alerta_kpa=35.0,
        tensao_limite_kpa=50.0,
        taxa_secagem_kpa_dia=2.0,
        cultura_nome="Milho"
    )
    assert pred_ideal["status"] == "IDEAL"
    assert pred_ideal["dias_restantes_estimados"] == 14.0

    # 3. Predição com salto para seca extrema (Caetano puxa o sensor: 48 kPa em Alface com limite 28 kPa)
    pred_urgente = prever_estresse_hidrico(
        tensao_atual_kpa=48.0,
        tensao_alerta_kpa=20.0,
        tensao_limite_kpa=28.0,
        taxa_secagem_kpa_dia=2.0,
        cultura_nome="Alface"
    )
    assert pred_urgente["status"] == "CRITICO_IRRIGAR_JA"
    assert pred_urgente["dias_restantes_estimados"] == 0.0
    assert "🚨 URGENTE" in pred_urgente["mensagem_bot"]


def test_sqlite_perfis_e_historico_endpoints():
    from backend.server import listar_perfis_cultura, obter_historico_7dias, obter_predicao_estresse, resetar_demonstracao

    # 1. Reset da demonstração
    res_reset = resetar_demonstracao()
    assert res_reset["sucesso"] is True

    # 2. Perfis da Embrapa
    perfis_data = listar_perfis_cultura()
    assert perfis_data["total"] >= 4
    ids = [p["id_perfil"] for p in perfis_data["perfis"]]
    assert "olericultura_alface_argissolo" in ids
    assert "graos_milho_argissolo" in ids

    # 3. Histórico de 7 dias
    hist_alface = obter_historico_7dias(no_id="esp32_no_01")
    assert hist_alface["total"] >= 6
    assert hist_alface["leituras"][0]["dia_label"] == "D-5"

    # 4. Predição
    pred_res = obter_predicao_estresse(id_perfil="graos_milho_argissolo", no_id="esp32_no_02")
    assert "taxa_secagem_kpa_dia" in pred_res
    assert "predicao" in pred_res
    assert "Embrapa" in pred_res["fonte_cientifica"]


def test_endpoint_telemetria_adc_gatilho_caetano():
    from backend.server import receber_telemetria_adc, LeituraADCIn
    bg = BackgroundTasks()

    # Simula Caetano no ar seco (ADC = 3800)
    dado_adc = LeituraADCIn(
        leitura_adc=3800,
        no_id="esp32_no_01",
        id_perfil="olericultura_alface_argissolo"
    )
    res = receber_telemetria_adc(dado_adc, bg)
    assert res["sucesso"] is True
    assert res["tensao_kpa"] > 60.0, "Leitura ADC de 3800 deve converter para > 60 kPa"
    assert res["predicao"]["status"] == "CRITICO_IRRIGAR_JA"


def test_classificacao_fisica_solo_tabela_embrapa():
    from backend.motor_predicao import classificar_estado_hidrico_solo

    # Saturação (0 kPa) -> Falta de oxigênio / risco de hipóxia
    sat = classificar_estado_hidrico_solo(0.0, "franco")
    assert sat["estado_hidrico"] == "Saturação"
    assert sat["agua_disponivel_pct"] == 100
    assert "falta de oxigênio" in sat["condicao_planta"]
    assert sat["risco_hipoxia"] is True

    # Capacidade de Campo (15 kPa)
    cc = classificar_estado_hidrico_solo(15.0, "franco")
    assert cc["estado_hidrico"] == "Capacidade de Campo (CC)"
    assert cc["agua_disponivel_pct"] == 100
    assert "ideal" in cc["condicao_planta"]

    # Início do Estresse / Fator p (35 kPa)
    estresse_p = classificar_estado_hidrico_solo(35.0, "franco")
    assert estresse_p["estado_hidrico"] == "Início do Estresse (Fator p)"
    assert 40 <= estresse_p["agua_disponivel_pct"] <= 60
    assert "Ponto crítico" in estresse_p["condicao_planta"]

    # Estresse Severo (150 kPa)
    sev = classificar_estado_hidrico_solo(150.0, "franco")
    assert sev["estado_hidrico"] == "Estresse Moderado a Severo"
    assert "Fechamento estomático" in sev["condicao_planta"]

    # Ponto de Murcha Permanente (1500 kPa)
    pmp = classificar_estado_hidrico_solo(1500.0, "franco")
    assert pmp["estado_hidrico"] == "Ponto de Murcha Permanente (PMP)"
    assert pmp["agua_disponivel_pct"] == 0
    assert "não recupera a turgidez" in pmp["condicao_planta"]


def test_arquitetura_ninhura_gateway_endpoint():
    from backend.server import receber_telemetria_gateway, listar_nos_ninhura, GatewayPacoteIn
    bg = BackgroundTasks()

    # 1. Envia telemetria via Gateway do Nó 1 (Alface)
    pct1 = GatewayPacoteIn(
        gateway_id="esp32_gateway",
        no_id="esp32_no_01",
        leitura_adc=1800,
        id_perfil="olericultura_alface_argissolo",
        temp_c=23.5,
        bateria_mv=3300,
        rssi_espnow=-62
    )
    res_gateway = receber_telemetria_gateway(pct1, bg)
    assert res_gateway["sucesso"] is True
    assert res_gateway["gateway_id"] == "esp32_gateway"
    assert res_gateway["no_id"] == "esp32_no_01"
    assert "estado_hidrico" in res_gateway
    assert "condicao_planta" in res_gateway

    # 2. Consulta a topologia da Ninhura
    topologia = listar_nos_ninhura()
    assert "Ninhura" in topologia["arquitetura"]
    assert "decisao_engenharia" in topologia
    assert "Telegram" in topologia["decisao_engenharia"]
    assert topologia["gateway"]["no_id"] == "esp32_gateway"
    assert len(topologia["nos"]) >= 4
    assert any(n["no_id"] == "esp32_no_04" for n in topologia["nos"])
    assert len(topologia["tabela_fisica_solo_referencia"]) == 5


def test_ninhura_gateway_quarto_no_tomate():
    from backend.server import receber_telemetria_gateway, GatewayPacoteIn
    bg = BackgroundTasks()

    pct_tomate = GatewayPacoteIn(
        gateway_id="esp32_gateway",
        no_id="esp32_no_04",
        leitura_adc=2400,
        id_perfil="olericultura_tomate_argissolo",
        temp_c=25.0,
        bateria_mv=3280,
        rssi_espnow=-81
    )
    res = receber_telemetria_gateway(pct_tomate, bg)
    assert res["sucesso"] is True
    assert res["no_id"] == "esp32_no_04"
    assert "estado_hidrico" in res


def test_endpoint_clima_previsao():
    from backend.server import obter_previsao_clima

    res = obter_previsao_clima(lat=-30.0346, lon=-51.2177, cidade="Porto Alegre")
    assert "temperatura_c" in res
    assert "chuva_prevista_24h_mm" in res
    assert "probabilidade_chuva_max_pct" in res
    assert "vento_velocidade_kmh" in res
    assert "vento_rajadas_kmh" in res
    assert "recomendacao_manejo" in res
    assert isinstance(res["alerta_suspensao_irrigacao"], bool)
    assert isinstance(res["alerta_vendaval"], bool)


