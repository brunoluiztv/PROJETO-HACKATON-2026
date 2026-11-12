"""Roteamento de texto livre para os assuntos do bot (sem dependência do Telegram)."""

from conteudo import BTN_FOTO, BTN_RECEITA, BTN_SECA, BTN_USAR

BOTOES = {
    BTN_FOTO: "foto",
    BTN_SECA: "seca",
    BTN_USAR: "usar",
    BTN_RECEITA: "receita",
}

PALAVRAS = [
    ("foto", ("cor", "selo", "foto")),
    ("seca", ("seca", "estiagem", "quantos")),
    ("usar", ("como usar", "terra", "apodrece", "veneno")),
    ("receita", ("receita", "fazer", "custo")),
]


def rotear(texto: str | None) -> str:
    """Devolve: foto | seca | usar | receita | fallback."""
    if not texto:
        return "fallback"
    if texto in BOTOES:
        return BOTOES[texto]
    t = texto.lower().strip()
    # Atalho numérico só quando a mensagem é exatamente o número do menu.
    atalhos = {"1": "foto", "2": "seca", "3": "usar", "4": "receita"}
    if t in atalhos:
        return atalhos[t]
    for assunto, chaves in PALAVRAS:
        if any(c in t for c in chaves):
            return assunto
    return "fallback"
