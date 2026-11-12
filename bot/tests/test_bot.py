import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from PIL import Image

import conteudo
from classificador import classificar_cor, classificar_rgb
from roteamento import rotear


def _png(cor):
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), cor).save(buf, format="PNG")
    return buf.getvalue()


def test_classifica_vermelho():
    assert classificar_cor(_png((200, 40, 40))) == "vermelho"


def test_classifica_amarelo():
    assert classificar_cor(_png((220, 200, 40))) == "amarelo"


def test_classifica_verde():
    assert classificar_cor(_png((40, 170, 60))) == "verde"


def test_escuro_e_cinza_sao_ambiguos():
    assert classificar_cor(_png((10, 10, 10))) is None
    assert classificar_cor(_png((128, 128, 128))) is None
    assert classificar_rgb(255, 255, 255) is None


def test_roteamento_botoes_e_palavras():
    assert rotear(conteudo.BTN_FOTO) == "foto"
    assert rotear(conteudo.BTN_SECA) == "seca"
    assert rotear(conteudo.BTN_USAR) == "usar"
    assert rotear(conteudo.BTN_RECEITA) == "receita"
    assert rotear("quanto custa a receita?") == "receita"
    assert rotear("2") == "seca"


def test_digito_solto_nao_roteia_errado():
    # No original, "1" in txt capturava qualquer texto com o dígito 1.
    assert rotear("tenho 15 sacos") == "fallback"


def test_texto_ausente():
    assert rotear(None) == "fallback"
    assert rotear("") == "fallback"


def test_numeros_chave_do_conteudo():
    assert conteudo.LITROS_POR_SACO == 13
    assert "195 litros" in conteudo.SECA
    assert "1.040 litros" in conteudo.SECA
    assert "5,80" in conteudo.RECEITA
    assert set(conteudo.LAUDOS) == {"verde", "amarelo", "vermelho"}
