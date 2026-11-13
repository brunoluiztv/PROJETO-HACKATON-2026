"""Roteamento de mensagens de texto livre para os tópicos do Tekó Biotech."""

from conteudo import (
    BTN_BATERIA,
    BTN_BOMBA,
    BTN_CHUVA,
    BTN_PAINEL,
    BTN_PLANTA,
    BTN_SOLO,
)

BOTOES = {
    BTN_PLANTA: "planta",
    BTN_BOMBA: "bomba",
    BTN_CHUVA: "chuva",
    BTN_BATERIA: "bateria",
    BTN_PAINEL: "painel",
    BTN_SOLO: "solo",
}

PALAVRAS = [
    ("planta", ("planta", "caule", "sentinela", "como está", "saude", "saúde")),
    ("bomba", ("irrigar", "regar", "bomba", "água", "agua", "seco", "sede")),
    ("chuva", ("chuva", "enchente", "alagamento", "encharcada", "afogada", "raiz", "hipoxia", "hipóxia")),
    ("bateria", ("energia", "bateria", "pilha", "solar", "manutencao", "manutenção", "choque")),
    ("painel", ("grafico", "gráfico", "painel", "laudo", "proagro", "seguro", "relatorio", "relatório")),
    ("solo", ("solo", "terra", "textura", "arenoso", "argiloso", "franco")),
    ("clima", ("clima", "tempo", "vento", "vendaval", "ciclone", "previsao", "previsão")),
]


def rotear(texto: str | None) -> str:
    """Devolve: planta | bomba | chuva | bateria | painel | solo | fallback."""
    if not texto:
        return "fallback"
    if texto in BOTOES:
        return BOTOES[texto]
    t = texto.lower().strip()
    atalhos = {
        "1": "planta",
        "2": "bomba",
        "3": "chuva",
        "4": "bateria",
        "5": "painel",
        "6": "solo",
    }
    if t in atalhos:
        return atalhos[t]
    for assunto, chaves in PALAVRAS:
        if any(c in t for c in chaves):
            return assunto
    return "fallback"
