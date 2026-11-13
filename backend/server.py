"""
Tekó Biotech — Backend FastAPI para Ingestão e Processamento Fitoeletrônico
Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Drenagem Rural
"""

import os
import time
from collections import deque
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from database import (
        inicializar_banco,
        resetar_dados_demonstracao,
        obter_perfis_cultura,
        obter_perfil_por_id,
        obter_historico_leituras as obter_historico_sqlite,
        salvar_nova_leitura,
        registrar_alerta_banco
    )
    from motor_predicao import (
        adc_para_kpa_simulado,
        calcular_taxa_secagem,
        prever_estresse_hidrico,
        classificar_estado_hidrico_solo
    )
except ImportError:
    from backend.database import (
        inicializar_banco,
        resetar_dados_demonstracao,
        obter_perfis_cultura,
        obter_perfil_por_id,
        obter_historico_leituras as obter_historico_sqlite,
        salvar_nova_leitura,
        registrar_alerta_banco
    )
    from backend.motor_predicao import (
        adc_para_kpa_simulado,
        calcular_taxa_secagem,
        prever_estresse_hidrico,
        classificar_estado_hidrico_solo
    )

# Carrega variáveis de ambiente procurando em múltiplos caminhos do projeto
load_dotenv()
_base_dir = os.path.dirname(os.path.abspath(__file__))
for env_path in [
    os.path.join(_base_dir, ".env"),
    os.path.join(_base_dir, "..", ".env"),
    os.path.join(_base_dir, "..", "bot", ".env")
]:
    if os.path.exists(env_path):
        load_dotenv(env_path, override=False)

# ============================================================================
# CONFIGURAÇÕES E CONSTANTES
# ============================================================================
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()
TELEGRAM_ALERT_CHAT_ID = (
    os.getenv("TELEGRAM_ALERT_CHAT_ID", "").strip()
    or os.getenv("TELEGRAM_CHAT_ID", "").strip()
    or os.getenv("ADMIN_CHAT_ID", "").strip()
)

APP_START_TIME = time.time()
MAX_HISTORICO = 50
TEMPO_EXPIRACAO_FISICO_SEG = 30  # Se não receber dados em 30s, considera offline

# Controle de taxa de envio de alertas push no Telegram (anti-flood)
_ultimo_alerta_ts: Dict[str, float] = {}
INTERVALO_MIN_ALERTA_SEG = 60.0

app = FastAPI(
    title="Tekó Biotech API",
    description="Servidor de telemetria fitoeletrônica in-planta para agricultura familiar e resiliência climática.",
    version="1.0.0"
)

# Habilita CORS amplo para integração suave com WebApp (GitHub Pages, Netlify e Localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# MODELOS DE DADOS (PYDANTIC)
# ============================================================================
class TelemetriaIn(BaseModel):
    node_id: str = Field(default="sentinela-01", description="ID único do nó ESP32")
    tensao_kpa: float = Field(..., ge=0.0, le=250.0, description="Potencial matricial Ψm em kPa")
    tipo_solo: Optional[str] = Field(default=None, description="arenoso, franco ou argiloso")
    resistencia_ohms: Optional[float] = Field(default=None, description="Resistência ôhmica do sensor")
    z_50k_ohms: Optional[float] = Field(default=None, description="Bioimpedância de caule a 50 kHz")
    z_1k_ohms: Optional[float] = Field(default=None, description="Bioimpedância de caule a 1 kHz")
    orp_mv: Optional[float] = Field(default=None, description="Potencial Redox da rizosfera em mV")
    ce_dsm: Optional[float] = Field(default=None, description="Condutividade elétrica em dS/m")
    pmfc_mv: Optional[float] = Field(default=None, description="Tensão de bioenergia microbiana P-MFC")
    bateria_mv: Optional[int] = Field(default=3300, description="Tensão da bateria em mV")
    rssi: Optional[int] = Field(default=-60, description="RSSI Wi-Fi em dBm")


class ConfigSoloIn(BaseModel):
    tipo_solo: str = Field(..., description="arenoso, franco ou argiloso")


class TelemetriaRegistro(BaseModel):
    id: int
    timestamp_iso: str
    segundos_desde_leitura: float
    fonte: str  # "fisico" ou "simulado"
    node_id: str
    tipo_solo: str
    agua_disponivel_pct: int
    tensao_kpa: float
    resistencia_ohms: float
    z_50k_ohms: float
    z_1k_ohms: float
    orp_mv: float
    ce_dsm: float
    pmfc_mv: float
    bateria_mv: int
    rssi: int
    estado: str  # "hidratada", "sede", "hipoxia"
    status_bomba: str
    acao_recomendada: str
    alerta_ativo: bool


class SimularIn(BaseModel):
    estado: Optional[str] = Field(default=None, description="hidratada, sede ou hipoxia")
    tensao_kpa: Optional[float] = Field(default=None, ge=0.0, le=250.0)
    tipo_solo: Optional[str] = Field(default=None, description="arenoso, franco ou argiloso")
    node_id: Optional[str] = "sentinela-simulador"


class LeituraADCIn(BaseModel):
    leitura_adc: int = Field(..., ge=0, le=4095, description="Valor analógico ADC (0 a 4095) do ESP32")
    no_id: Optional[str] = Field(default="esp32_no_01", description="ID do nó transmissor")
    id_perfil: Optional[str] = Field(default="olericultura_alface_argissolo", description="Perfil de cultura Embrapa")
    temp_c: Optional[float] = Field(default=25.0, description="Temperatura do solo em °C")
    bateria_mv: Optional[int] = Field(default=3300, description="Tensão da bateria em mV")


class GatewayPacoteIn(BaseModel):
    gateway_id: str = Field(default="esp32_gateway", description="ID do ESP32 Gateway receptor da Ninhura")
    no_id: str = Field(default="esp32_no_01", description="ID do nó de aquisição ESP-NOW (ex: esp32_no_01, esp32_no_02, esp32_no_03)")
    leitura_adc: Optional[int] = Field(default=None, ge=0, le=4095, description="Valor ADC bruto se transmitido")
    tensao_kpa: Optional[float] = Field(default=None, ge=0.0, le=250.0, description="Potencial matricial em kPa")
    tipo_solo: Optional[str] = Field(default=None, description="arenoso, franco ou argiloso")
    id_perfil: Optional[str] = Field(default="olericultura_alface_argissolo", description="Perfil Embrapa da cultura")
    temp_c: Optional[float] = Field(default=24.5, description="Temperatura do solo em °C")
    bateria_mv: Optional[int] = Field(default=3300, description="Tensão da bateria em mV")
    rssi_espnow: Optional[int] = Field(default=-65, description="Intensidade do rádio ESP-NOW em dBm")


# ============================================================================
# CONFIGURAÇÕES AGRONÔMICAS DE SOLOS (UERGS 2026)
# ============================================================================
CONFIG_SOLOS: Dict[str, Dict[str, Any]] = {
    "arenoso": {
        "id": "arenoso",
        "nome": "Solo Arenoso (Leve / Litoral)",
        "cc_kpa": 10.0,
        "estresse_kpa": 30.0,
        "severo_kpa": 60.0,
        "murcha_kpa": 1500.0,
        "orientacao_bomba": "Irrigue com turnos frequentes e curtos. Em 30 kPa já necessita de irrigação."
    },
    "franco": {
        "id": "franco",
        "nome": "Solo Franco / Médio",
        "cc_kpa": 22.0,
        "estresse_kpa": 45.0,
        "severo_kpa": 60.0,
        "murcha_kpa": 1500.0,
        "orientacao_bomba": "Gotejamento matinal programado para às 6h da manhã."
    },
    "argiloso": {
        "id": "argiloso",
        "nome": "Solo Argiloso (Terra Roxa / Várzea)",
        "cc_kpa": 33.0,
        "estresse_kpa": 65.0,
        "severo_kpa": 120.0,
        "murcha_kpa": 1500.0,
        "orientacao_bomba": "Alta retenção. Em 33 kPa o solo ainda tem água abundante para as raízes."
    }
}

_tipo_solo_ativo: str = "franco"


# ============================================================================
# ARMAZENAMENTO EM MEMÓRIA
# ============================================================================
_registro_contador = 0
_historico_leituras: deque = deque(maxlen=MAX_HISTORICO)
_ultima_leitura_fisica: Optional[Dict[str, Any]] = None
_ultima_leitura_geral: Optional[Dict[str, Any]] = None

# Topologia da Arquitetura da Ninhura (Nós ESP-NOW + Gateway)
_ninhura_nos: Dict[str, Dict[str, Any]] = {
    "esp32_no_01": {
        "no_id": "esp32_no_01",
        "nome": "Nó Sentinela 01",
        "cultura": "Alface Crespa",
        "talhao": "Talhão 01 (Hortaliças)",
        "protocolo": "ESP-NOW (2.4 GHz)",
        "gateway_vinculado": "esp32_gateway",
        "status": "online",
        "tensao_kpa": 25.5,
        "rssi_espnow": -64,
        "bateria_mv": 3280,
        "ultima_leitura_iso": datetime.now(timezone.utc).isoformat()
    },
    "esp32_no_02": {
        "no_id": "esp32_no_02",
        "nome": "Nó Sentinela 02",
        "cultura": "Milho (Vegetativo)",
        "talhao": "Talhão 02 (Grãos)",
        "protocolo": "ESP-NOW (2.4 GHz)",
        "gateway_vinculado": "esp32_gateway",
        "status": "online",
        "tensao_kpa": 32.0,
        "rssi_espnow": -71,
        "bateria_mv": 3285,
        "ultima_leitura_iso": datetime.now(timezone.utc).isoformat()
    },
    "esp32_no_03": {
        "no_id": "esp32_no_03",
        "nome": "Nó Sentinela 03",
        "cultura": "Feijão",
        "talhao": "Talhão 03 (Leguminosas)",
        "protocolo": "ESP-NOW (2.4 GHz)",
        "gateway_vinculado": "esp32_gateway",
        "status": "online",
        "tensao_kpa": 21.0,
        "rssi_espnow": -68,
        "bateria_mv": 3310,
        "ultima_leitura_iso": datetime.now(timezone.utc).isoformat()
    },
    "esp32_no_04": {
        "no_id": "esp32_no_04",
        "nome": "Nó Sentinela 04",
        "cultura": "Tomate / Morango",
        "talhao": "Talhão 04 (Frutos)",
        "protocolo": "ESP-NOW (2.4 GHz)",
        "gateway_vinculado": "esp32_gateway",
        "status": "online",
        "tensao_kpa": 27.0,
        "rssi_espnow": -62,
        "bateria_mv": 3300,
        "ultima_leitura_iso": datetime.now(timezone.utc).isoformat()
    },
    "esp32_gateway": {
        "no_id": "esp32_gateway",
        "nome": "ESP32 Gateway da Ninhura",
        "funcao": "Recepção ESP-NOW e Encaminhamento HTTP POST",
        "uplink": "Wi-Fi / 4G LTE",
        "status": "ativo",
        "nos_conectados": 4,
        "pacotes_roteados": 142,
        "ultima_atividade_iso": datetime.now(timezone.utc).isoformat()
    }
}


# ============================================================================
# LÓGICA AGRONÔMICA E CORRELAÇÃO DE PARÂMETROS
# ============================================================================
def calcular_agua_disponivel_pct(tensao_kpa: float, tipo_solo: str = "franco") -> int:
    """
    Calcula a porcentagem de Água Disponível (AD %) baseada na curva de retenção do solo:
    - Se <= Capacidade de Campo (CC): 100%
    - Se entre CC e Estresse: 100% a 50%
    - Se entre Estresse e Ponto de Murcha: 50% a 0%
    """
    import math
    cfg = CONFIG_SOLOS.get(tipo_solo, CONFIG_SOLOS["franco"])
    t = max(0.0, float(tensao_kpa))

    if t <= cfg["cc_kpa"]:
        return 100
    elif t <= cfg["estresse_kpa"]:
        fator = (t - cfg["cc_kpa"]) / (cfg["estresse_kpa"] - cfg["cc_kpa"])
        return max(50, min(100, round(100.0 - (fator * 50.0))))
    elif t <= cfg["murcha_kpa"]:
        log_atual = math.log10(max(1.0, t))
        log_estresse = math.log10(cfg["estresse_kpa"])
        log_murcha = math.log10(cfg["murcha_kpa"])
        fator = (log_atual - log_estresse) / (log_murcha - log_estresse)
        return max(0, min(50, round(50.0 - (fator * 50.0))))
    else:
        return 0


def classificar_estado_agronomico(tensao_kpa: float, orp_mv: float, tipo_solo: str = "franco") -> str:
    """
    Classifica o estado eletrofisiológico da planta sentinela com base no tipo de solo:
    - hipoxia: Solo saturado pós-enchente (< 45% da CC) ou raiz sem O2 (ORP < -100 mV)
    - sede: Início de estresse hídrico específico para a textura do solo
    - hidratada: Capacidade de campo ideal
    """
    cfg = CONFIG_SOLOS.get(tipo_solo, CONFIG_SOLOS["franco"])

    limite_hipoxia_kpa = cfg["cc_kpa"] * 0.45
    if tensao_kpa < limite_hipoxia_kpa or orp_mv < -100.0:
        return "hipoxia"
    elif tensao_kpa > cfg["estresse_kpa"]:
        return "sede"
    else:
        return "hidratada"


def enriquecer_telemetria(dado: TelemetriaIn, fonte: str = "fisico") -> Dict[str, Any]:
    global _registro_contador
    _registro_contador += 1

    solo = dado.tipo_solo or _tipo_solo_ativo
    if solo not in CONFIG_SOLOS:
        solo = _tipo_solo_ativo

    cfg = CONFIG_SOLOS[solo]
    tensao = round(float(dado.tensao_kpa), 2)

    # Preenche valores correlacionados padrão caso o sensor envie nulo
    if dado.orp_mv is not None:
        orp = round(float(dado.orp_mv), 1)
    else:
        if tensao < (cfg["cc_kpa"] * 0.45):
            orp = -140.0
        elif tensao > cfg["severo_kpa"]:
            orp = 480.0
        elif tensao > cfg["estresse_kpa"]:
            orp = 420.0
        else:
            orp = 310.0

    estado = classificar_estado_agronomico(tensao, orp, tipo_solo=solo)
    ad_pct = calcular_agua_disponivel_pct(tensao, tipo_solo=solo)

    # Estima valores fisiológicos correlacionados se ausentes
    if dado.z_50k_ohms is not None:
        z50k = round(float(dado.z_50k_ohms), 1)
    else:
        if estado == "hipoxia":
            z50k = 5900.0
        elif estado == "sede":
            z50k = 4800.0
        else:
            z50k = 1420.0

    if dado.z_1k_ohms is not None:
        z1k = round(float(dado.z_1k_ohms), 1)
    else:
        if estado == "hipoxia":
            z1k = 5100.0
        elif estado == "sede":
            z1k = 3900.0
        else:
            z1k = 1100.0

    if dado.ce_dsm is not None:
        ce = round(float(dado.ce_dsm), 2)
    else:
        ce = 0.60 if estado == "hipoxia" else (1.80 if estado == "sede" else 1.20)

    if dado.pmfc_mv is not None:
        pmfc = round(float(dado.pmfc_mv), 1)
    else:
        pmfc = 520.0 if estado == "hipoxia" else (450.0 if estado == "sede" else 580.0)

    if dado.resistencia_ohms is not None:
        resistencia = round(float(dado.resistencia_ohms), 1)
    else:
        resistencia = 800.0 if estado == "hipoxia" else (6500.0 if estado == "sede" else 2200.0)

    # Ações para o produtor rural
    if estado == "hipoxia":
        status_bomba = "NÃO LIGAR A BOMBA!"
        acao = f"Solo {cfg['nome']} saturado e asfixia radicular. Abra valetas de drenagem e emita o Laudo PROAGRO."
        alerta_ativo = True
    elif estado == "sede":
        status_bomba = "LIGAR AMANHÃ ÀS 06H"
        acao = f"Solo {cfg['nome']}: Início de estresse ({tensao} kPa > limite {cfg['estresse_kpa']} kPa). {cfg['orientacao_bomba']}"
        alerta_ativo = (tensao >= 60.0 or tensao > cfg["severo_kpa"])
    else:
        status_bomba = "BOMBA DESLIGADA"
        acao = f"Solo {cfg['nome']}: Umidade ideal ({ad_pct}% de água disponível). Manter bomba desligada."
        alerta_ativo = False

    agora = datetime.now(timezone.utc)
    info_hidrica = classificar_estado_hidrico_solo(tensao, tipo_solo=solo)
    registro = {
        "id": _registro_contador,
        "timestamp_unix": agora.timestamp(),
        "timestamp_iso": agora.isoformat(),
        "fonte": fonte,
        "node_id": dado.node_id,
        "tipo_solo": solo,
        "solo_nome": cfg["nome"],
        "estado_hidrico_solo": info_hidrica["estado_hidrico"],
        "potencial_matricial_label": info_hidrica["potencial_matricial_label"],
        "fator_p_esgotamento": info_hidrica["fator_p_esgotamento"],
        "condicao_planta": info_hidrica["condicao_planta"],
        "agua_disponivel_pct": ad_pct,
        "cc_kpa": cfg["cc_kpa"],
        "estresse_kpa": cfg["estresse_kpa"],
        "tensao_kpa": tensao,
        "resistencia_ohms": resistencia,
        "z_50k_ohms": z50k,
        "z_1k_ohms": z1k,
        "orp_mv": orp,
        "ce_dsm": ce,
        "pmfc_mv": pmfc,
        "bateria_mv": dado.bateria_mv or 3300,
        "rssi": dado.rssi or -60,
        "estado": estado,
        "status_bomba": status_bomba,
        "acao_recomendada": acao,
        "alerta_ativo": alerta_ativo
    }
    return registro


# ============================================================================
# ENVIO ASSÍNCRONO DE ALERTAS TELEGRAM
# ============================================================================
def despachar_alerta_telegram_se_necessario(registro: Dict[str, Any]):
    if not TELEGRAM_TOKEN or not TELEGRAM_ALERT_CHAT_ID:
        return

    estado = registro["estado"]
    tensao = registro["tensao_kpa"]
    orp = registro["orp_mv"]

    # Dispara apenas em condições de risco comprovado
    deve_alertar = False
    tipo_alerta = ""
    texto_alerta = ""

    if estado == "hipoxia" or orp < -100.0:
        deve_alertar = True
        tipo_alerta = "hipoxia"
        texto_alerta = (
            "🚨 <b>ALERTA DE ENCHENTE & ASFIXIA RADICULAR!</b>\n\n"
            f"🌱 <b>Nó Sentinela:</b> {registro['node_id']}\n"
            f"🌊 <b>Potencial Matricial:</b> {tensao} kPa (Solo Saturado)\n"
            f"⚡ <b>ORP Rizosfera:</b> {orp} mV (Anóxia Radicular Severa)\n"
            f"🩺 <b>Z caule (50 kHz):</b> {registro['z_50k_ohms']} Ω (Aquaporinas fechadas)\n\n"
            "🚜 <b>Ação Urgente:</b> Não ligue a bomba! Abra valetas de drenagem imediatamente "
            "e emita o Laudo Oficial PROAGRO no painel web."
        )
    elif tensao > 60.0:
        deve_alertar = True
        tipo_alerta = "seca_severa"
        texto_alerta = (
            "⚠️ <b>ALERTA DE SECA SEVERA / PONTO DE MURCHA!</b>\n\n"
            f"🌱 <b>Nó Sentinela:</b> {registro['node_id']}\n"
            f"☀️ <b>Potencial Matricial:</b> {tensao} kPa (Déficit Hídrico Crítico)\n"
            f"💧 <b>Z caule (50 kHz):</b> {registro['z_50k_ohms']} Ω\n\n"
            "🚜 <b>Ação Recomendada:</b> Programe irrigação de emergência para a primeira hora da manhã."
        )

    if not deve_alertar:
        return

    # Controle de throttling
    agora_ts = time.time()
    ultimo_ts = _ultimo_alerta_ts.get(tipo_alerta, 0.0)
    if (agora_ts - ultimo_ts) < INTERVALO_MIN_ALERTA_SEG:
        return

    _ultimo_alerta_ts[tipo_alerta] = agora_ts

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_ALERT_CHAT_ID,
        "text": texto_alerta,
        "parse_mode": "HTML"
    }

    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                print(f"[Telegram Push] Alerta '{tipo_alerta}' enviado com sucesso!")
            else:
                print(f"[Telegram Push] Erro {resp.status_code}: {resp.text}")
    except Exception as exc:
        print(f"[Telegram Push] Falha ao enviar alerta Telegram: {exc}")


# Cache simples para a previsão meteorológica (evita chamadas excessivas)
_clima_cache: Dict[str, Any] = {
    "timestamp": 0.0,
    "dados": None
}

@app.get("/api/clima/previsao")
def obter_previsao_clima(
    lat: float = Query(-29.1722, description="Latitude do talhão"),
    lon: float = Query(-51.5189, description="Longitude do talhão"),
    cidade: str = Query("Bento Gonçalves", description="Nome do município")
):
    """
    Retorna previsão meteorológica do talhão para as próximas 24-48 horas
    integrada com a API gratuita Open-Meteo para inteligência de irrigação preditiva.
    """
    agora = time.time()
    cache_key = f"{lat:.2f}_{lon:.2f}"
    
    if _clima_cache.get("key") == cache_key and (agora - _clima_cache.get("timestamp", 0)) < 900:
        return _clima_cache["dados"]
        
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&"
        f"current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&"
        f"hourly=precipitation_probability,precipitation,wind_gusts_10m&forecast_days=2&timezone=America%2FSao_Paulo"
    )
    
    dados_clima = None
    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                raw = resp.json()
                current = raw.get("current", {})
                hourly = raw.get("hourly", {})
                
                prob_max = 0
                chuva_total_24h = 0.0
                max_rajada = float(current.get("wind_gusts_10m") or 0.0)
                
                probs = hourly.get("precipitation_probability", [])[:24]
                precips = hourly.get("precipitation", [])[:24]
                gusts = hourly.get("wind_gusts_10m", [])[:24]
                
                if probs:
                    prob_max = max(probs)
                if precips:
                    chuva_total_24h = round(sum(precips), 1)
                if gusts:
                    max_rajada = max(max_rajada, max(gusts))
                    
                suspender_irrigacao = prob_max >= 75 and chuva_total_24h >= 15.0
                alerta_vendaval = max_rajada >= 60.0
                alerta_drenagem_preventiva = chuva_total_24h >= 80.0
                
                dados_clima = {
                    "sucesso": True,
                    "municipio": cidade,
                    "coordenadas": {"lat": lat, "lon": lon},
                    "temperatura_atual_c": current.get("temperature_2m", 22.0),
                    "temperatura_c": current.get("temperature_2m", 22.0),
                    "umidade_ar_pct": current.get("relative_humidity_2m", 78),
                    "umidade_relativa_pct": current.get("relative_humidity_2m", 78),
                    "chuva_atual_mm": current.get("precipitation", 0.0),
                    "vento_atual_kmh": current.get("wind_speed_10m", 12.0),
                    "vento_velocidade_kmh": current.get("wind_speed_10m", 12.0),
                    "rajada_max_24h_kmh": round(max_rajada, 1),
                    "vento_rajadas_kmh": round(max_rajada, 1),
                    "chuva_prevista_24h_mm": chuva_total_24h,
                    "probabilidade_chuva_max_pct": prob_max,
                    "suspender_irrigacao": suspender_irrigacao,
                    "alerta_suspensao_irrigacao": suspender_irrigacao,
                    "alerta_vendaval": alerta_vendaval,
                    "alerta_drenagem_preventiva": alerta_drenagem_preventiva,
                    "recomendacao_agronomica": (
                        f"⏳ Suspender irrigação: chuva de {chuva_total_24h} mm prevista nas próximas 24h ({prob_max}% prob). Poupe diesel e evite encharcar a raiz!"
                        if suspender_irrigacao else
                        "💧 Irrigação liberada: sem previsão de chuva torrencial próxima."
                    ),
                    "recomendacao_manejo": (
                        f"⏳ Suspender irrigação: chuva de {chuva_total_24h} mm prevista nas próximas 24h ({prob_max}% prob). Poupe diesel e evite encharcar a raiz!"
                        if suspender_irrigacao else
                        "💧 Irrigação liberada: sem previsão de chuva torrencial próxima."
                    ),
                    "fonte": "Open-Meteo / Modelos Meteorológicos Globais de Alta Resolução"
                }
    except Exception as exc:
        print(f"[Clima] Erro ao consultar Open-Meteo: {exc}")
        
    if not dados_clima:
        dados_clima = {
            "sucesso": True,
            "fallback": True,
            "municipio": cidade,
            "coordenadas": {"lat": lat, "lon": lon},
            "temperatura_atual_c": 23.5,
            "temperatura_c": 23.5,
            "umidade_ar_pct": 82,
            "umidade_relativa_pct": 82,
            "chuva_atual_mm": 0.0,
            "vento_atual_kmh": 14.0,
            "vento_velocidade_kmh": 14.0,
            "rajada_max_24h_kmh": 42.0,
            "vento_rajadas_kmh": 42.0,
            "chuva_prevista_24h_mm": 32.0,
            "probabilidade_chuva_max_pct": 85,
            "suspender_irrigacao": True,
            "alerta_suspensao_irrigacao": True,
            "alerta_vendaval": False,
            "alerta_drenagem_preventiva": False,
            "recomendacao_agronomica": "⏳ Suspender irrigação: chuva de 32 mm prevista nas próximas 24h. Poupe combustível e preserve os açudes!",
            "recomendacao_manejo": "⏳ Suspender irrigação: chuva de 32 mm prevista nas próximas 24h. Poupe combustível e preserve os açudes!",
            "fonte": "Simulador Climático Regional RS / Open-Meteo"
        }
        
    _clima_cache["key"] = cache_key
    _clima_cache["timestamp"] = agora
    _clima_cache["dados"] = dados_clima
    return dados_clima


# ============================================================================
# ROTAS DA API FASTAPI
# ============================================================================

@app.get("/")
def raiz():
    return {
        "sistema": "Tekó Biotech API",
        "versao": "1.0.0",
        "hackathon": "UERGS 2026 — Desafio 02: Água e Drenagem Rural",
        "endpoints": [
            "/api/health",
            "/api/config/solo (GET/POST)",
            "/api/telemetria (POST)",
            "/api/telemetria/atual (GET)",
            "/api/telemetria/historico (GET)",
            "/api/telemetria/simular (POST)"
        ]
    }


@app.get("/api/config/solo")
def obter_config_solo():
    """Retorna o tipo de solo ativo e a tabela de calibração agronômica."""
    return {
        "solo_ativo": _tipo_solo_ativo,
        "detalhes_ativo": CONFIG_SOLOS[_tipo_solo_ativo],
        "solos_disponiveis": CONFIG_SOLOS
    }


@app.post("/api/config/solo")
def definir_tipo_solo(dados: ConfigSoloIn):
    """
    Atualiza o tipo de solo selecionado pelo agricultor no formulário (arenoso, franco ou argiloso).
    Recalcula a última leitura ativa para refletir instantaneamente a nova curva de retenção de água.
    """
    global _tipo_solo_ativo, _ultima_leitura_fisica, _ultima_leitura_geral

    solo = dados.tipo_solo.lower().strip()
    if solo not in CONFIG_SOLOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de solo inválido: '{dados.tipo_solo}'. Opções aceitas: {list(CONFIG_SOLOS.keys())}"
        )

    _tipo_solo_ativo = solo
    cfg = CONFIG_SOLOS[solo]

    # Recalcula a leitura ativa se existir
    for ref_dict in [_ultima_leitura_fisica, _ultima_leitura_geral]:
        if ref_dict is not None:
            tensao = ref_dict["tensao_kpa"]
            orp = ref_dict["orp_mv"]
            novo_estado = classificar_estado_agronomico(tensao, orp, tipo_solo=solo)
            nova_ad = calcular_agua_disponivel_pct(tensao, tipo_solo=solo)
            ref_dict["tipo_solo"] = solo
            ref_dict["solo_nome"] = cfg["nome"]
            ref_dict["estado"] = novo_estado
            ref_dict["agua_disponivel_pct"] = nova_ad
            ref_dict["cc_kpa"] = cfg["cc_kpa"]
            ref_dict["estresse_kpa"] = cfg["estresse_kpa"]
            if novo_estado == "hipoxia":
                ref_dict["status_bomba"] = "NÃO LIGAR A BOMBA!"
                ref_dict["acao_recomendada"] = f"Solo {cfg['nome']} saturado e asfixia radicular. Abra valetas de drenagem e emita o Laudo PROAGRO."
            elif novo_estado == "sede":
                ref_dict["status_bomba"] = "LIGAR AMANHÃ ÀS 06H"
                ref_dict["acao_recomendada"] = f"Solo {cfg['nome']}: Início de estresse ({tensao} kPa > limite {cfg['estresse_kpa']} kPa). {cfg['orientacao_bomba']}"
            else:
                ref_dict["status_bomba"] = "BOMBA DESLIGADA"
                ref_dict["acao_recomendada"] = f"Solo {cfg['nome']}: Umidade ideal ({nova_ad}% de água disponível). Manter bomba desligada."

    return {
        "sucesso": True,
        "mensagem": f"Tipo de solo alterado para {cfg['nome']}",
        "solo_ativo": solo,
        "configuracao": cfg
    }


@app.get("/api/health")
def health():
    uptime = round(time.time() - APP_START_TIME, 1)
    return {
        "status": "ok",
        "uptime_segundos": uptime,
        "leituras_processadas": _registro_contador,
        "historico_tamanho": len(_historico_leituras),
        "tem_leitura_fisica": _ultima_leitura_fisica is not None
    }


@app.post("/api/telemetria", status_code=status.HTTP_201_CREATED)
def receber_telemetria(dado: TelemetriaIn, background_tasks: BackgroundTasks):
    """
    Ingestão principal de dados do ESP32 físico.
    Recebe os dados analógicos do sensor de potencial matricial, correlaciona
    a bioimpedância e dispara alerta se houver risco de hipóxia ou seca extrema.
    """
    global _ultima_leitura_fisica, _ultima_leitura_geral

    registro = enriquecer_telemetria(dado, fonte="fisico")
    _ultima_leitura_fisica = registro
    _ultima_leitura_geral = registro
    _historico_leituras.append(registro)

    # Envia alerta Telegram em background sem bloquear o retorno do ESP32
    if registro["alerta_ativo"]:
        background_tasks.add_task(despachar_alerta_telegram_se_necessario, registro)

    return {
        "sucesso": True,
        "mensagem": "Telemetria registrada com sucesso",
        "registro": registro
    }


@app.get("/api/telemetria/atual")
def obter_telemetria_atual(tipo_solo: Optional[str] = None):
    """
    Retorna o estado mais recente lido. Se houver transmissão recente do ESP32 (<=30s),
    marca como 'fisico' com sensor_fisico_online=True.
    Caso o sensor físico esteja ausente ou expirado, prioriza leituras gerais/simuladas
    recentes, garantindo fallback e dinamismo no painel.
    Permite passar ?tipo_solo=arenoso|franco|argiloso para calibrar a leitura dinamicamente.
    """
    agora_ts = time.time()
    solo_consulta = (tipo_solo.lower().strip() if tipo_solo and tipo_solo.lower().strip() in CONFIG_SOLOS else None)

    def _ajustar_solo(item: Dict[str, Any]) -> Dict[str, Any]:
        copia = dict(item)
        solo = solo_consulta or copia.get("tipo_solo") or _tipo_solo_ativo
        if solo in CONFIG_SOLOS:
            cfg = CONFIG_SOLOS[solo]
            tensao = copia["tensao_kpa"]
            orp = copia.get("orp_mv", 310.0)
            copia["tipo_solo"] = solo
            copia["solo_nome"] = cfg["nome"]
            copia["estado"] = classificar_estado_agronomico(tensao, orp, tipo_solo=solo)
            copia["agua_disponivel_pct"] = calcular_agua_disponivel_pct(tensao, tipo_solo=solo)
            copia["cc_kpa"] = cfg["cc_kpa"]
            copia["estresse_kpa"] = cfg["estresse_kpa"]
            if copia["estado"] == "hipoxia":
                copia["status_bomba"] = "NÃO LIGAR A BOMBA!"
                copia["acao_recomendada"] = f"Solo {cfg['nome']} saturado e asfixia radicular. Abra valetas de drenagem e emita o Laudo PROAGRO."
            elif copia["estado"] == "sede":
                copia["status_bomba"] = "LIGAR AMANHÃ ÀS 06H"
                copia["acao_recomendada"] = f"Solo {cfg['nome']}: Início de estresse ({tensao} kPa > limite {cfg['estresse_kpa']} kPa). {cfg['orientacao_bomba']}"
            else:
                copia["status_bomba"] = "BOMBA DESLIGADA"
                copia["acao_recomendada"] = f"Solo {cfg['nome']}: Umidade ideal ({copia['agua_disponivel_pct']}% de água disponível). Manter bomba desligada."
        return copia

    # 1. Prioriza leitura física ATIVA recente (<= 30 segundos)
    if _ultima_leitura_fisica is not None:
        delta_fisica = agora_ts - _ultima_leitura_fisica["timestamp_unix"]
        if delta_fisica <= TEMPO_EXPIRACAO_FISICO_SEG:
            leitura = _ajustar_solo(_ultima_leitura_fisica)
            leitura["segundos_desde_leitura"] = round(delta_fisica, 1)
            leitura["sensor_fisico_online"] = True
            return leitura

    # 2. Se o sensor físico expirou ou nunca enviou, prioriza simulação recente
    if _ultima_leitura_geral is not None:
        delta_geral = agora_ts - _ultima_leitura_geral["timestamp_unix"]
        leitura = _ajustar_solo(_ultima_leitura_geral)
        leitura["segundos_desde_leitura"] = round(delta_geral, 1)
        leitura["sensor_fisico_online"] = False
        return leitura

    # 3. Se temos leitura física legada expirada (e nenhuma simulação)
    if _ultima_leitura_fisica is not None:
        delta_fisica = agora_ts - _ultima_leitura_fisica["timestamp_unix"]
        leitura = _ajustar_solo(_ultima_leitura_fisica)
        leitura["segundos_desde_leitura"] = round(delta_fisica, 1)
        leitura["sensor_fisico_online"] = False
        return leitura

    # 4. Baseline padrão caso o servidor tenha acabado de inicializar
    baseline = enriquecer_telemetria(
        TelemetriaIn(
            node_id="sentinela-01",
            tensao_kpa=22.5,
            orp_mv=310.0,
            tipo_solo=solo_consulta or _tipo_solo_ativo
        ),
        fonte="padrao_inicial"
    )
    baseline["segundos_desde_leitura"] = 0.0
    baseline["sensor_fisico_online"] = False
    return baseline


@app.get("/api/telemetria/historico")
def obter_historico_telemetria():
    """Retorna as últimas 50 leituras ordenadas cronologicamente."""
    return {
        "total": len(_historico_leituras),
        "leituras": list(_historico_leituras)
    }


@app.post("/api/telemetria/simular")
def simular_telemetria(dados_sim: SimularIn):
    """
    Injeta medição para fins de teste no palco ou demonstração sem ESP32 plugado.
    """
    global _ultima_leitura_geral

    tensao = dados_sim.tensao_kpa
    estado = dados_sim.estado
    solo = dados_sim.tipo_solo or _tipo_solo_ativo

    if tensao is None:
        cfg = CONFIG_SOLOS.get(solo, CONFIG_SOLOS["franco"])
        if estado == "hipoxia":
            tensao = cfg["cc_kpa"] * 0.3
        elif estado == "sede":
            tensao = cfg["estresse_kpa"] + 5.0
        else:
            tensao = cfg["cc_kpa"]

    tele_in = TelemetriaIn(
        node_id=dados_sim.node_id or "sentinela-simulador",
        tensao_kpa=tensao,
        tipo_solo=solo
    )

    registro = enriquecer_telemetria(tele_in, fonte="simulado")
    _ultima_leitura_geral = registro
    _historico_leituras.append(registro)

    return {
        "sucesso": True,
        "mensagem": "Simulação aplicada com sucesso",
        "registro": registro
    }


# ============================================================================
# ROTAS DE PREDIÇÃO, HISTÓRICO 7 DIAS E HARDWARE (PITCH 5 MINUTOS)
# ============================================================================

def enviar_alerta_preditivo_telegram(texto_alerta: str, tipo_alerta: str = "predicao_estresse"):
    """Disparo de alerta preditivo no Telegram respeitando taxa anti-flood."""
    if not TELEGRAM_TOKEN or not TELEGRAM_ALERT_CHAT_ID:
        return
    agora_ts = time.time()
    ultimo_ts = _ultimo_alerta_ts.get(tipo_alerta, 0.0)
    if (agora_ts - ultimo_ts) < INTERVALO_MIN_ALERTA_SEG:
        return
    _ultimo_alerta_ts[tipo_alerta] = agora_ts

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_ALERT_CHAT_ID,
        "text": texto_alerta,
        "parse_mode": "HTML"
    }
    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                print(f"[Telegram Push Preditivo] Alerta '{tipo_alerta}' enviado com sucesso!")
            else:
                print(f"[Telegram Push Preditivo] Erro {resp.status_code}: {resp.text}")
    except Exception as exc:
        print(f"[Telegram Push Preditivo] Falha ao enviar alerta Telegram: {exc}")


@app.on_event("startup")
def startup_event():
    try:
        inicializar_banco()
        print("[SQLite] Banco de dados e perfis Embrapa inicializados com sucesso.")
    except Exception as exc:
        print(f"[SQLite Init] Falha ao inicializar banco: {exc}")


@app.get("/api/perfis-cultura")
def listar_perfis_cultura():
    """Retorna os perfis de cultura cadastrados com limites científicos da Embrapa."""
    perfis = obter_perfis_cultura()
    return {
        "total": len(perfis),
        "perfis": perfis
    }


@app.get("/api/historico")
def obter_historico_7dias(no_id: Optional[str] = None, id_perfil: Optional[str] = None):
    """Retorna as leituras históricas do SQLite (7 dias simulados + leituras do ESP32)."""
    leituras = obter_historico_sqlite(no_id=no_id, id_perfil=id_perfil)
    return {
        "total": len(leituras),
        "no_id": no_id,
        "id_perfil": id_perfil,
        "leituras": leituras
    }


@app.get("/api/predicao")
def obter_predicao_estresse(
    id_perfil: str = "olericultura_alface_argissolo",
    no_id: str = "esp32_no_01",
    tensao_override: Optional[float] = None
):
    """
    Calcula a taxa de secagem (ΔkPa/dia) e os dias restantes até o ponto de manejo Embrapa.
    """
    perfil = obter_perfil_por_id(id_perfil)
    if not perfil:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Perfil de cultura '{id_perfil}' não encontrado."
        )

    leituras = obter_historico_sqlite(no_id=no_id, id_perfil=id_perfil)
    taxa_secagem = calcular_taxa_secagem(leituras)

    if tensao_override is not None:
        tensao_atual = tensao_override
    elif leituras:
        tensao_atual = leituras[-1]["tensao_kpa"]
    else:
        tensao_atual = perfil["tensao_capacidade_campo_kpa"]

    pred = prever_estresse_hidrico(
        tensao_atual_kpa=tensao_atual,
        tensao_alerta_kpa=perfil["tensao_alerta_kpa"],
        tensao_limite_kpa=perfil["tensao_critica_manejo_kpa"],
        taxa_secagem_kpa_dia=taxa_secagem,
        cultura_nome=perfil["cultura"]
    )

    return {
        "no_id": no_id,
        "perfil": perfil,
        "taxa_secagem_kpa_dia": taxa_secagem,
        "predicao": pred,
        "fonte_cientifica": perfil["fonte_cientifica"]
    }


@app.post("/api/telemetria/adc", status_code=status.HTTP_201_CREATED)
def receber_telemetria_adc(dado: LeituraADCIn, background_tasks: BackgroundTasks):
    """
    Endpoint dedicado para a demonstração do hardware de bancada (Gatilho do Caetano).
    Converte leitura ADC (0-4095) para tensão matricial (10-80 kPa), salva no SQLite,
    atualiza o motor preditivo e dispara o Telegram ao vivo se cruzar o limite Embrapa.
    """
    global _ultima_leitura_fisica, _ultima_leitura_geral

    kpa = adc_para_kpa_simulado(dado.leitura_adc)
    perfil = obter_perfil_por_id(dado.id_perfil)
    nome_cultura = perfil["cultura"] if perfil else "Cultura"
    limite_kpa = perfil["tensao_critica_manejo_kpa"] if perfil else 50.0
    alerta_kpa = perfil["tensao_alerta_kpa"] if perfil else 35.0

    # Salva leitura no SQLite
    registro_banco = salvar_nova_leitura(
        no_id=dado.no_id,
        id_perfil=dado.id_perfil,
        tensao_kpa=kpa,
        temp_c=dado.temp_c or 25.0,
        bateria_mv=dado.bateria_mv or 3300,
        dia_label="Ao Vivo (Bancada)",
        is_simulado=0
    )

    # Calcula taxa e predição
    leituras = obter_historico_sqlite(no_id=dado.no_id, id_perfil=dado.id_perfil)
    taxa_secagem = calcular_taxa_secagem(leituras)
    pred = prever_estresse_hidrico(
        tensao_atual_kpa=kpa,
        tensao_alerta_kpa=alerta_kpa,
        tensao_limite_kpa=limite_kpa,
        taxa_secagem_kpa_dia=taxa_secagem,
        cultura_nome=nome_cultura
    )

    # Atualiza telemetria em memória para sincronia com /api/telemetria/atual
    tele_in = TelemetriaIn(
        node_id=dado.no_id,
        tensao_kpa=kpa,
        tipo_solo=_tipo_solo_ativo,
        bateria_mv=dado.bateria_mv
    )
    registro_geral = enriquecer_telemetria(tele_in, fonte="fisico")
    _ultima_leitura_fisica = registro_geral
    _ultima_leitura_geral = registro_geral
    _historico_leituras.append(registro_geral)

    # Disparo de alerta no Telegram ao vivo se for urgente ou atenção
    if pred["status"] in ["CRITICO_IRRIGAR_JA", "ALERTA_IMINENTE"]:
        registrar_alerta_banco(
            no_id=dado.no_id,
            id_perfil=dado.id_perfil,
            tensao_kpa=kpa,
            taxa_secagem_kpa_dia=taxa_secagem,
            dias_restantes=pred["dias_restantes_estimados"],
            status=pred["status"],
            mensagem=pred["mensagem_bot"],
            enviado_telegram=1
        )
        background_tasks.add_task(
            enviar_alerta_preditivo_telegram,
            pred["mensagem_bot"],
            f"gatilho_adc_{pred['status']}"
        )

    return {
        "sucesso": True,
        "leitura_adc": dado.leitura_adc,
        "tensao_kpa": kpa,
        "predicao": pred,
        "registro_id": registro_banco["id"],
        "fonte_cientifica": perfil["fonte_cientifica"] if perfil else "Embrapa"
    }


@app.post("/api/telemetria/gateway", status_code=status.HTTP_201_CREATED)
def receber_telemetria_gateway(pacote: GatewayPacoteIn, background_tasks: BackgroundTasks):
    """
    Ingestão de dados da 'Arquitetura da Ninhura':
    O ESP32 Gateway recebe pacotes locais via rádio ESP-NOW dos Nós Sentinelas (1, 2 e 3)
    e encaminha via Wi-Fi/4G HTTP POST para o Backend FastAPI.
    Desacoplamento: O ESP32 não fala com o Telegram; o FastAPI centraliza alertas e regras Embrapa.
    """
    global _ultima_leitura_fisica, _ultima_leitura_geral, _ninhura_nos

    # Converte ADC para kPa se necessário
    if pacote.tensao_kpa is not None:
        kpa = round(float(pacote.tensao_kpa), 1)
    elif pacote.leitura_adc is not None:
        kpa = adc_para_kpa_simulado(pacote.leitura_adc)
    else:
        kpa = 22.0

    perfil = obter_perfil_por_id(pacote.id_perfil)
    nome_cultura = perfil["cultura"] if perfil else "Cultura"
    limite_kpa = perfil["tensao_critica_manejo_kpa"] if perfil else 45.0
    alerta_kpa = perfil["tensao_alerta_kpa"] if perfil else 30.0

    # Atualiza topologia do nó na Ninhura
    agora_iso = datetime.now(timezone.utc).isoformat()
    if pacote.no_id not in _ninhura_nos:
        _ninhura_nos[pacote.no_id] = {
            "no_id": pacote.no_id,
            "nome": f"Nó Sentinela ({pacote.no_id})",
            "cultura": nome_cultura,
            "talhao": "Talhão Remoto",
            "protocolo": "ESP-NOW (2.4 GHz)",
            "gateway_vinculado": pacote.gateway_id,
            "status": "online",
            "tensao_kpa": kpa,
            "rssi_espnow": pacote.rssi_espnow or -65,
            "bateria_mv": pacote.bateria_mv or 3300,
            "ultima_leitura_iso": agora_iso
        }
    else:
        _ninhura_nos[pacote.no_id]["tensao_kpa"] = kpa
        _ninhura_nos[pacote.no_id]["bateria_mv"] = pacote.bateria_mv or 3300
        _ninhura_nos[pacote.no_id]["rssi_espnow"] = pacote.rssi_espnow or -65
        _ninhura_nos[pacote.no_id]["ultima_leitura_iso"] = agora_iso
        _ninhura_nos[pacote.no_id]["status"] = "online"

    # Atualiza estatísticas do Gateway
    if "esp32_gateway" in _ninhura_nos:
        _ninhura_nos["esp32_gateway"]["pacotes_roteados"] = _ninhura_nos["esp32_gateway"].get("pacotes_roteados", 0) + 1
        _ninhura_nos["esp32_gateway"]["ultima_atividade_iso"] = agora_iso

    # Salva no SQLite
    registro_banco = salvar_nova_leitura(
        no_id=pacote.no_id,
        id_perfil=pacote.id_perfil,
        tensao_kpa=kpa,
        temp_c=pacote.temp_c or 24.5,
        bateria_mv=pacote.bateria_mv or 3300,
        dia_label="Ninhura ESP-NOW",
        is_simulado=0
    )

    # Motor Preditivo
    leituras = obter_historico_sqlite(no_id=pacote.no_id, id_perfil=pacote.id_perfil)
    taxa_secagem = calcular_taxa_secagem(leituras)
    pred = prever_estresse_hidrico(
        tensao_atual_kpa=kpa,
        tensao_alerta_kpa=alerta_kpa,
        tensao_limite_kpa=limite_kpa,
        taxa_secagem_kpa_dia=taxa_secagem,
        cultura_nome=nome_cultura
    )

    # Enriquecimento
    tele_in = TelemetriaIn(
        node_id=pacote.no_id,
        tensao_kpa=kpa,
        tipo_solo=pacote.tipo_solo or _tipo_solo_ativo,
        bateria_mv=pacote.bateria_mv
    )
    registro_geral = enriquecer_telemetria(tele_in, fonte="gateway_espnow")
    _ultima_leitura_fisica = registro_geral
    _ultima_leitura_geral = registro_geral
    _historico_leituras.append(registro_geral)

    # Alerta Telegram
    if pred["status"] in ["CRITICO_IRRIGAR_JA", "ALERTA_IMINENTE"]:
        registrar_alerta_banco(
            no_id=pacote.no_id,
            id_perfil=pacote.id_perfil,
            tensao_kpa=kpa,
            taxa_secagem_kpa_dia=taxa_secagem,
            dias_restantes=pred["dias_restantes_estimados"],
            status=pred["status"],
            mensagem=pred["mensagem_bot"],
            enviado_telegram=1
        )
        background_tasks.add_task(
            enviar_alerta_preditivo_telegram,
            pred["mensagem_bot"],
            f"gateway_{pred['status']}"
        )

    return {
        "sucesso": True,
        "gateway_id": pacote.gateway_id,
        "no_id": pacote.no_id,
        "tensao_kpa": kpa,
        "estado_hidrico": registro_geral["estado_hidrico_solo"],
        "potencial_matricial_label": registro_geral["potencial_matricial_label"],
        "agua_disponivel_pct": registro_geral["agua_disponivel_pct"],
        "condicao_planta": registro_geral["condicao_planta"],
        "predicao": pred,
        "registro_id": registro_banco["id"]
    }


@app.get("/api/ninhura/nos")
def listar_nos_ninhura():
    """
    Retorna a topologia completa da 'Arquitetura da Ninhura':
    - Camada de aquisição: Nós 1, 2 e 3 (ESP32 via ESP-NOW)
    - Gateway: ESP32 Gateway centralizador (Wi-Fi/4G HTTP POST)
    - Princípio de desacoplamento de hardware e regras de negócio.
    """
    gateway_info = _ninhura_nos.get("esp32_gateway", {})
    nos_lista = [v for k, v in _ninhura_nos.items() if k != "esp32_gateway"]

    return {
        "arquitetura": "Ninhura Mesh (ESP-NOW + ESP32 Gateway + FastAPI)",
        "decisao_engenharia": "ESP32 NÃO fala direto com o Telegram para economizar bateria em campo (Deep Sleep de 14 mAh/dia). Toda a inteligência de regras Embrapa, Laudo PROAGRO e alertas fica centralizada no FastAPI.",
        "gateway": gateway_info,
        "total_nos_ativos": len(nos_lista),
        "nos": nos_lista,
        "tabela_fisica_solo_referencia": [
            {"estado": "Saturado", "psi_m": "0 kPa", "ad_pct": "100%", "condicao": "Excesso de água e falta de oxigênio nas raízes."},
            {"estado": "Capacidade de Campo (CC)", "psi_m": "-10 a -33 kPa", "ad_pct": "100% (Limite superior)", "condicao": "Condição ideal de umidade e aeração."},
            {"estado": "Início do Estresse (Fator p)", "psi_m": "-30 a -70 kPa", "ad_pct": "40% a 60% restantes", "condicao": "Ponto crítico para reiniciar a irrigação sem perda produtiva."},
            {"estado": "Estresse Moderado a Severo", "psi_m": "-100 a -500 kPa", "ad_pct": "15% a 35% restantes", "condicao": "Fechamento estomático, redução da fotossíntese e murcha."},
            {"estado": "Ponto de Murcha Permanente (PMP)", "psi_m": "-1500 kPa (-1.5 MPa)", "ad_pct": "0%", "condicao": "Água fortemente retida; a planta não recupera a turgidez."}
        ]
    }


@app.post("/api/demo/reset")
def resetar_demonstracao():
    """Restaura o SQLite para os 7 dias simulados originais do pitch."""
    res = resetar_dados_demonstracao()
    return {
        "sucesso": True,
        "resultado": res
    }
