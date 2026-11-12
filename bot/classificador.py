"""Leitura da cor do selo a partir de uma foto.

Mantém o ROI central (30% do centro) e as regras do bot original para vermelho e amarelo.
Diferença de segurança: o que não for claramente verde retorna None (ambíguo), em vez de
cair em "verde" como no original. O bot então pede confirmação pelos botões de cor.
"""

import io

import numpy as np
from PIL import Image


def media_rgb_central(img_bytes: bytes) -> tuple[float, float, float]:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    w, h = img.size
    crop = img.crop((int(w * 0.35), int(h * 0.35), int(w * 0.65), int(h * 0.65)))
    arr = np.array(crop)
    return float(arr[:, :, 0].mean()), float(arr[:, :, 1].mean()), float(arr[:, :, 2].mean())


def classificar_rgb(r: float, g: float, b: float) -> str | None:
    # Vermelho de verdade: R alto e dominante sobre G e B (evita falso positivo em magenta/roxo)
    if r > g + 25 and r > b + 25 and r > 120:
        return "vermelho"
    # Amarelo de verdade: R e G altos e B bem menor (foto branca/estourada é ambígua).
    if r > 145 and g > 130 and b < min(r, g) - 40:
        return "amarelo"
    # Verde de verdade: G dominante sobre R e B com boa saturação
    if g >= r + 15 and g >= b + 15 and (max(r, g, b) - min(r, g, b)) > 20 and 60 < g < 230:
        return "verde"
    return None


def classificar_cor(img_bytes: bytes) -> str | None:
    """Retorna 'verde', 'amarelo', 'vermelho' ou None (ambíguo)."""
    return classificar_rgb(*media_rgb_central(img_bytes))
