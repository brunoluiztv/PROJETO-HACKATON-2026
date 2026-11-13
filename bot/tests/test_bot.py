import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import conteudo
from roteamento import rotear
from telemetria import DADOS_ESTADOS, calcular_economia_hectares, obter_telemetria_tempo_real


def test_estados_telemetria():
    assert set(DADOS_ESTADOS.keys()) == {"hidratada", "sede", "hipoxia"}

    # Hidratada
    h = DADOS_ESTADOS["hidratada"]
    assert h["z_50k_kohm"] == 1.4
    assert h["orp_mv"] == 310
    assert h["bomba"] == "DESLIGADA"
    assert h["laudo_proagro"] is False
    assert h["tensao_kpa"] == 21.5

    # Sede invisível
    s = DADOS_ESTADOS["sede"]
    assert s["z_50k_kohm"] == 4.8
    assert s["orp_mv"] == 420
    assert "06H" in s["bomba"]
    assert s["laudo_proagro"] is False
    assert s["tensao_kpa"] == 45.0

    # Hipóxia / Enchente
    hip = DADOS_ESTADOS["hipoxia"]
    assert hip["z_50k_kohm"] == 5.9
    assert hip["orp_mv"] == -140
    assert hip["laudo_proagro"] is True
    assert "NÃO LIGAR" in hip["bomba"]
    assert hip["tensao_kpa"] == 4.2


def test_obter_telemetria_tempo_real_fallback():
    # URL inexistente deve acionar fallback resiliente sem lançar exceção
    dados = obter_telemetria_tempo_real(backend_url="http://127.0.0.1:59999")
    assert dados["online"] is False
    assert dados["origem"] == "fallback_local"
    assert dados["estado"] == "hidratada"
    assert dados["tensao_kpa"] == 21.5
    assert dados["sensor_fisico_online"] is False


def test_calculo_economia_hectares():
    calc_1 = calcular_economia_hectares(1)
    assert calc_1["hectares"] == 1.0
    assert calc_1["sensores_sentinelas"] == 1
    assert calc_1["litros_poupados_mes"] == 4200 * 8
    assert calc_1["reais_economizados_mes"] == 38.0 * 8

    calc_10 = calcular_economia_hectares(10)
    assert calc_10["hectares"] == 10.0
    assert calc_10["sensores_sentinelas"] == 10
    assert calc_10["litros_poupados_mes"] == 10 * 4200 * 8

    # Limites (1 a 15)
    calc_min = calcular_economia_hectares(0.5)
    assert calc_min["hectares"] == 1.0
    calc_max = calcular_economia_hectares(25.0)
    assert calc_max["hectares"] == 15.0


def test_roteamento_botoes_principais():
    assert rotear(conteudo.BTN_PLANTA) == "planta"
    assert rotear(conteudo.BTN_BOMBA) == "bomba"
    assert rotear(conteudo.BTN_CHUVA) == "chuva"
    assert rotear(conteudo.BTN_BATERIA) == "bateria"
    assert rotear(conteudo.BTN_PAINEL) == "painel"
    assert rotear(conteudo.BTN_SOLO) == "solo"


def test_roteamento_atalhos_numericos():
    assert rotear("1") == "planta"
    assert rotear("2") == "bomba"
    assert rotear("3") == "chuva"
    assert rotear("4") == "bateria"
    assert rotear("5") == "painel"
    assert rotear("6") == "solo"


def test_roteamento_palavras_chave():
    assert rotear("Como está a saúde da sentinela?") == "planta"
    assert rotear("Devo ligar a bomba hoje?") == "bomba"
    assert rotear("A enchente alagou a raiz do milho") == "chuva"
    assert rotear("De onde vem a energia da bateria?") == "bateria"
    assert rotear("Gostaria de emitir o laudo do proagro") == "painel"
    assert rotear("Como configurar o tipo de solo?") == "solo"
    assert rotear("Meu solo é arenoso") == "solo"
    assert rotear("A terra é muito argilosa") == "solo"


def test_solos_info_existencia():
    from telemetria import SOLOS_INFO
    assert "arenoso" in SOLOS_INFO
    assert "franco" in SOLOS_INFO
    assert "argiloso" in SOLOS_INFO
    assert SOLOS_INFO["arenoso"]["cc_kpa"] == 10.0
    assert SOLOS_INFO["argiloso"]["cc_kpa"] == 33.0


def test_roteamento_casos_borda():
    assert rotear(None) == "fallback"
    assert rotear("") == "fallback"
    assert rotear("   ") == "fallback"
    assert rotear("olá tudo bem") == "fallback"
    # Dígito dentro de frase não deve rotear por atalho numérico
    assert rotear("colhi 15 sacas de milho") == "fallback"


def test_conteudo_proagro_e_duvidas():
    assert "-140 mV" in conteudo.LAUDO_PROAGRO_TEXTO
    assert "PROAGRO" in conteudo.LAUDO_PROAGRO_TEXTO
    assert "mamona" in conteudo.DUVIDAS_PRODUTOR.lower()
    assert "ágar" in conteudo.DUVIDAS_PRODUTOR.lower() or "agar" in conteudo.DUVIDAS_PRODUTOR.lower()
    assert "bactérias" in conteudo.DUVIDAS_PRODUTOR.lower() or "bacterias" in conteudo.DUVIDAS_PRODUTOR.lower()


def test_responder_telemetria_formata_dados_reais():
    from phytosense_bot import responder_telemetria, bot
    from unittest.mock import MagicMock

    # Mock do envio de mensagem do bot
    mock_send = MagicMock()
    bot.send_message = mock_send

    dados_reais = {
        "online": True,
        "sensor_fisico_online": True,
        "tensao_kpa": 19.8,
        "z_50k_ohms": 1520.0,
        "orp_mv": 325.0,
        "estado": "hidratada"
    }

    responder_telemetria(12345, estado="hidratada", dados_reais=dados_reais)
    assert mock_send.called
    msg_enviada = mock_send.call_args[0][1]
    assert "19.8 kPa" in msg_enviada
    assert "1.5 kΩ" in msg_enviada
    assert "+325 mV" in msg_enviada
    assert "SENSOR FÍSICO ESP32 ONLINE" in msg_enviada


def test_zero_termos_antigos_em_modulos_python():
    termos_proibidos = ["saco biodegradavel", "sacos biodegradáveis", "casca de arroz", "agrosponge"]
    arquivos = [conteudo.__file__, DADOS_ESTADOS.__class__.__module__]
    
    with open(conteudo.__file__, "r", encoding="utf-8") as f:
        texto_conteudo = f.read().lower()
        for t in termos_proibidos:
            assert t not in texto_conteudo, f"Termo proibido encontrado em conteudo.py: {t}"


def test_identidade_teko_persona():
    assert "Tekó" in conteudo.BOAS_VINDAS
    assert "Tekó" in conteudo.AUDIO_RESPOSTA
    assert "Tekó" in conteudo.DUVIDAS_PRODUTOR
    assert "Tekó" in conteudo.LAUDO_PROAGRO_TEXTO
    assert "harmonia com a terra" in conteudo.BOAS_VINDAS.lower()


def test_configurador_teko_declaracoes():
    from configurar_teko import NOME_BOT, SHORT_DESC, LONG_DESC, COMANDOS_TEKO
    assert "Tekó" in NOME_BOT
    assert "lavoura" in SHORT_DESC.lower()
    assert len(COMANDOS_TEKO) >= 5
    cmd_nomes = [c.command for c in COMANDOS_TEKO]
    assert "start" in cmd_nomes
    assert "planta" in cmd_nomes
    assert "bomba" in cmd_nomes
    assert "previsao" in cmd_nomes


def test_audio_zero_digitacao_conteudo():
    assert "zero digitação" in conteudo.AUDIO_RESPOSTA.lower()
    assert "botões grandes" in conteudo.AUDIO_RESPOSTA.lower()
    # Verifica que a promessa enganosa de transcrição foi removida
    assert "ouviu seu áudio" not in conteudo.AUDIO_RESPOSTA.lower()


def test_resposta_chuva_drenagem_conteudo():
    assert "drenando bem" in conteudo.RESPOSTA_CHUVA_NORMAL.lower()
    assert "aeróbico" in conteudo.RESPOSTA_CHUVA_NORMAL.lower()
    assert "bomba de irrigação deve permanecer desligada" in conteudo.RESPOSTA_CHUVA_NORMAL.lower()


def test_chuva_dinamica_raiz_saudavel():
    from phytosense_bot import cmd_chuva, bot
    from unittest.mock import MagicMock, patch

    mock_send = MagicMock()
    bot.send_message = mock_send

    tele_saudavel = {
        "online": True,
        "sensor_fisico_online": True,
        "tensao_kpa": 18.0,
        "orp_mv": 320.0,
        "estado": "hidratada"
    }

    mock_msg = MagicMock()
    mock_msg.chat.id = 99999

    with patch("phytosense_bot.obter_telemetria_tempo_real", return_value=tele_saudavel):
        cmd_chuva(mock_msg)
        assert mock_send.called
        msg_enviada = mock_send.call_args[0][1]
        assert "drenando bem" in msg_enviada.lower()
        assert "18.0 kPa" in msg_enviada
        assert "+320 mV" in msg_enviada


