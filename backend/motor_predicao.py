"""
Tekó Biotech — Motor de Cálculo Preditivo e Conversão de Hardware
Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Estresse Hídrico
Ancoragem Científica: Embrapa Hortaliças & Embrapa Milho e Sorgo
"""

from typing import List, Dict, Any, Optional


def adc_para_kpa_simulado(leitura_adc: int) -> float:
    """
    Converte a leitura bruta do sensor resistivo no ESP32 (0 a 4095)
    para uma faixa realista de Potencial Matricial Ψm (10 kPa = úmido a 80 kPa = seco).
    
    Calibração de Bancada (Pitch 5 min):
    - 1200 ou menos: sensor submerso em terra molhada (Capacidade de Campo = 10 kPa)
    - 4095: sensor no ar seco / retirado da terra (Estresse Severo = 80 kPa)
    """
    adc_min = 1200
    adc_max = 4095
    leitura_limitada = max(adc_min, min(leitura_adc, adc_max))
    proporcao_seca = (leitura_limitada - adc_min) / (adc_max - adc_min)
    kpa = 10.0 + (proporcao_seca * 70.0)
    return round(kpa, 1)


def calcular_taxa_secagem(leituras: List[Dict[str, Any]]) -> float:
    """
    Calcula a taxa de secagem média diária (ΔkPa/dia) a partir de uma lista
    ordenada de leituras com campo 'tensao_kpa'.
    
    Retorna pelo menos 1.5 kPa/dia como piso fisiológico de evapotranspiração no RS.
    """
    if not leituras or len(leituras) < 2:
        return 2.0  # Valor agronômico padrão de secagem no verão do RS (2 kPa/dia)

    # Pega primeira e última leitura da série temporal
    primeira = leituras[0].get("tensao_kpa", 0.0)
    ultima = leituras[-1].get("tensao_kpa", 0.0)
    delta_kpa = ultima - primeira
    num_intervalos = max(1, len(leituras) - 1)

    taxa = delta_kpa / float(num_intervalos)
    if taxa <= 0.1:
        taxa = 1.8  # Piso para manter modelo preditivo coerente se houve rega
    return round(taxa, 2)


def prever_estresse_hidrico(
    tensao_atual_kpa: float,
    tensao_alerta_kpa: float,
    tensao_limite_kpa: float,
    taxa_secagem_kpa_dia: float,
    cultura_nome: str = "Cultura"
) -> Dict[str, Any]:
    """
    Calcula os dias restantes até o ponto crítico de manejo da Embrapa
    e classifica a urgência de irrigação.
    """
    taxa_segura = max(0.5, taxa_secagem_kpa_dia)
    delta_ate_limite = tensao_limite_kpa - tensao_atual_kpa

    if delta_ate_limite <= 0:
        dias_restantes = 0.0
        status = "CRITICO_IRRIGAR_JA"
        urgencia = "alta"
        cor = "#ef4444"  # Vermelho
        mensagem_bot = (
            f"🚨 URGENTE: Sua lavoura de {cultura_nome} atingiu o limite crítico da Embrapa! "
            f"Tensão atual: {tensao_atual_kpa} kPa (Limite: {tensao_limite_kpa} kPa). "
            f"Irrigue imediatamente para evitar quebra de safra."
        )
    else:
        dias_restantes = round(delta_ate_limite / taxa_segura, 1)
        if dias_restantes <= 1.0 or tensao_atual_kpa >= tensao_alerta_kpa:
            status = "ALERTA_IMINENTE" if dias_restantes > 0 else "CRITICO_IRRIGAR_JA"
            urgencia = "media_alta"
            cor = "#ef4444" if dias_restantes <= 1.0 else "#f59e0b"
            mensagem_bot = (
                f"⚠️ ATENÇÃO: Sua lavoura de {cultura_nome} está secando a {taxa_segura} kPa/dia. "
                f"Tensão atual: {tensao_atual_kpa} kPa (Limite Embrapa: {tensao_limite_kpa} kPa). "
                f"Previsão de estresse hídrico em {dias_restantes} dias. Programe a irrigação."
            )
        elif dias_restantes <= 3.0:
            status = "ATENCAO_PREVENTIVA"
            urgencia = "media"
            cor = "#f59e0b"  # Amarelo
            mensagem_bot = (
                f"🌾 MONITORAMENTO: Sua lavoura de {cultura_nome} está com secagem estável de {taxa_segura} kPa/dia. "
                f"Tensão atual: {tensao_atual_kpa} kPa. Restam aprox. {dias_restantes} dias para o ponto de rega."
            )
        else:
            status = "IDEAL"
            urgencia = "baixa"
            cor = "#10b981"  # Verde
            mensagem_bot = (
                f"🌿 BOM ESTADO: Sua lavoura de {cultura_nome} tem boa reserva hídrica no solo. "
                f"Tensão atual: {tensao_atual_kpa} kPa. Estimativa de {dias_restantes} dias até o manejo."
            )

    return {
        "tensao_atual_kpa": tensao_atual_kpa,
        "tensao_alerta_kpa": tensao_alerta_kpa,
        "tensao_limite_kpa": tensao_limite_kpa,
        "taxa_secagem_kpa_dia": taxa_segura,
        "dias_restantes_estimados": dias_restantes,
        "status": status,
        "urgencia": urgencia,
        "cor": cor,
        "mensagem_bot": mensagem_bot
    }


def classificar_estado_hidrico_solo(tensao_kpa: float, tipo_solo: str = "franco") -> Dict[str, Any]:
    """
    Classificação física do solo e água disponível (AD %) conforme tabela
    científica de física do solo e potencial matricial (Ψm) da Embrapa:
    - Saturação: 0 kPa | 100% AD | Falta de oxigênio nas raízes
    - Capacidade de Campo (CC): -10 a -33 kPa | 100% AD (Limite superior) | Condição ideal
    - Início do Estresse (Fator p): -30 a -70 kPa | 40% a 60% restantes | Ponto crítico de irrigação
    - Estresse Moderado a Severo: -100 a -500 kPa | 15% a 35% restantes | Fechamento estomático
    - Ponto de Murcha Permanente (PMP): -1500 kPa | 0% AD | Murcha irreversível
    """
    t = max(0.0, float(tensao_kpa))
    solo = tipo_solo.lower()

    if t <= 5.0:
        return {
            "estado_hidrico": "Saturado",
            "potencial_matricial_label": "0 kPa",
            "agua_disponivel_pct": 100,
            "agua_disponivel_faixa": "100%",
            "fator_p_esgotamento": 0.0,
            "condicao_planta": "Excesso de água e falta de oxigênio nas raízes (saturado).",
            "cor": "#38bdf8",
            "risco_hipoxia": True
        }
    
    # Limites específicos de solo
    if solo == "arenoso":
        cc_max = 15.0
        estresse_max = 35.0
    elif solo == "argiloso":
        cc_max = 33.0
        estresse_max = 65.0
    else:  # franco / médio
        cc_max = 25.0
        estresse_max = 50.0

    if t <= cc_max:
        return {
            "estado_hidrico": "Capacidade de Campo (CC)",
            "potencial_matricial_label": f"-10 a -{int(cc_max)} kPa",
            "agua_disponivel_pct": 100,
            "agua_disponivel_faixa": "100% (Limite superior)",
            "fator_p_esgotamento": 0.0,
            "condicao_planta": "Condição ideal de umidade e aeração.",
            "cor": "#10b981",
            "risco_hipoxia": False
        }
    elif t <= estresse_max:
        # Fator p entre 40% e 60% restantes de AD
        fator = (t - cc_max) / (estresse_max - cc_max)
        ad_restante = max(40, min(60, round(60.0 - (fator * 20.0))))
        return {
            "estado_hidrico": "Início do Estresse (Fator p)",
            "potencial_matricial_label": "-30 a -70 kPa",
            "agua_disponivel_pct": ad_restante,
            "agua_disponivel_faixa": "40% a 60% restantes",
            "fator_p_esgotamento": round(0.40 + (fator * 0.20), 2),
            "condicao_planta": "Ponto crítico para reiniciar a irrigação sem perda produtiva.",
            "cor": "#f59e0b",
            "risco_hipoxia": False
        }
    elif t < 800.0:
        return {
            "estado_hidrico": "Estresse Moderado a Severo",
            "potencial_matricial_label": "-100 a -500 kPa",
            "agua_disponivel_pct": 20,
            "agua_disponivel_faixa": "15% a 35% restantes",
            "fator_p_esgotamento": 0.80,
            "condicao_planta": "Fechamento estomático, redução da fotossíntese e murcha.",
            "cor": "#ef4444",
            "risco_hipoxia": False
        }
    else:
        return {
            "estado_hidrico": "Ponto de Murcha Permanente (PMP)",
            "potencial_matricial_label": "-1.500 kPa (-1,5 MPa)",
            "agua_disponivel_pct": 0,
            "agua_disponivel_faixa": "0%",
            "fator_p_esgotamento": 1.0,
            "condicao_planta": "Água fortemente retida; a planta não recupera a turgidez.",
            "cor": "#7f1d1d",
            "risco_hipoxia": False
        }

