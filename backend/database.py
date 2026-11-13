"""
Tekó Biotech — Camada de Persistência SQLite
Hackathon das Engenharias UERGS 2026 — Desafio 02: Água e Estresse Hídrico
"""

import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "phytosense.db")
SEED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_demo_data.json")

_banco_inicializado = False


def inicializar_banco() -> None:
    """Cria as tabelas do SQLite se não existirem e popula com a carga de seed inicial."""
    global _banco_inicializado
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Tabela 1: Perfis Oficiais Embrapa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS perfis_cultura (
                id_perfil TEXT PRIMARY KEY,
                cultura TEXT NOT NULL,
                solo TEXT NOT NULL,
                profundidade_raiz_cm INTEGER NOT NULL,
                tensao_capacidade_campo_kpa REAL NOT NULL,
                tensao_alerta_kpa REAL NOT NULL,
                tensao_critica_manejo_kpa REAL NOT NULL,
                tensao_ponto_murcha_kpa REAL NOT NULL,
                fonte_cientifica TEXT NOT NULL
            );
        """)

        # Tabela 2: Leituras Históricas (7 dias simulados + leituras do nó ao vivo)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leituras_historicas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                no_id TEXT NOT NULL,
                id_perfil TEXT NOT NULL,
                dia_label TEXT NOT NULL,
                timestamp_iso TEXT NOT NULL,
                tensao_kpa REAL NOT NULL,
                temp_c REAL,
                bateria_mv INTEGER,
                is_simulado INTEGER DEFAULT 1,
                FOREIGN KEY (id_perfil) REFERENCES perfis_cultura (id_perfil)
            );
        """)

        # Tabela 3: Alertas Emitidos (Disparos no Telegram)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alertas_disparados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp_iso TEXT NOT NULL,
                no_id TEXT NOT NULL,
                id_perfil TEXT NOT NULL,
                tensao_kpa REAL NOT NULL,
                taxa_secagem_kpa_dia REAL NOT NULL,
                dias_restantes REAL NOT NULL,
                status TEXT NOT NULL,
                mensagem TEXT NOT NULL,
                enviado_telegram INTEGER DEFAULT 0
            );
        """)

        conn.commit()

    _banco_inicializado = True
    carregar_seed_se_vazio()


def obter_conexao() -> sqlite3.Connection:
    global _banco_inicializado
    if not _banco_inicializado:
        inicializar_banco()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def carregar_seed_se_vazio() -> None:
    """Popula os perfis Embrapa e histórico de 7 dias se a tabela estiver vazia."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as total FROM perfis_cultura")
        total_perfis = cursor.fetchone()["total"]

        if total_perfis == 0:
            resetar_dados_demonstracao()


def resetar_dados_demonstracao() -> Dict[str, Any]:
    """
    Restaura o SQLite para o estado original da demonstração de 5 minutos,
    populando 7 dias de histórico e os perfis Embrapa.
    """
    inicializar_banco()
    if not os.path.exists(SEED_PATH):
        return {"status": "erro", "mensagem": "Arquivo seed_demo_data.json não encontrado"}

    with open(SEED_PATH, "r", encoding="utf-8") as f:
        seed = json.load(f)

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("DELETE FROM alertas_disparados")
        cursor.execute("DELETE FROM leituras_historicas")
        cursor.execute("DELETE FROM perfis_cultura")

        # 1. Insere perfis
        for p in seed.get("perfis_cultura_referencia", []):
            cursor.execute("""
                INSERT INTO perfis_cultura (
                    id_perfil, cultura, solo, profundidade_raiz_cm,
                    tensao_capacidade_campo_kpa, tensao_alerta_kpa,
                    tensao_critica_manejo_kpa, tensao_ponto_murcha_kpa,
                    fonte_cientifica
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                p["id_perfil"], p["cultura"], p["solo"], p["profundidade_raiz_cm"],
                p["tensao_capacidade_campo_kpa"], p["tensao_alerta_kpa"],
                p["tensao_critica_manejo_kpa"], p["tensao_ponto_murcha_kpa"],
                p["fonte_cientifica"]
            ))

        # 2. Insere histórico de 7 dias
        agora = time.time()
        for item in seed.get("historico_simulado_leituras", []):
            dias_atras = item.get("dias_atras", 0)
            ts = agora - (dias_atras * 86400)
            iso = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
            cursor.execute("""
                INSERT INTO leituras_historicas (
                    no_id, id_perfil, dia_label, timestamp_iso, tensao_kpa, temp_c, bateria_mv, is_simulado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """, (
                item["no_id"], item["id_perfil"], item["dia_label"], iso,
                item["tensao_kpa"], item.get("temp_c", 24.0), item.get("bateria_mv", 3300)
            ))

        conn.commit()

    return {
        "status": "sucesso",
        "perfis_carregados": len(seed.get("perfis_cultura_referencia", [])),
        "leituras_carregadas": len(seed.get("historico_simulado_leituras", []))
    }


def obter_perfis_cultura() -> List[Dict[str, Any]]:
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM perfis_cultura ORDER BY cultura")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def obter_perfil_por_id(id_perfil: str) -> Optional[Dict[str, Any]]:
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM perfis_cultura WHERE id_perfil = ?", (id_perfil,))
        row = cursor.fetchone()
        return dict(row) if row else None


def obter_historico_leituras(no_id: Optional[str] = None, id_perfil: Optional[str] = None) -> List[Dict[str, Any]]:
    with obter_conexao() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM leituras_historicas WHERE 1=1"
        params: List[Any] = []
        if no_id:
            query += " AND no_id = ?"
            params.append(no_id)
        if id_perfil:
            query += " AND id_perfil = ?"
            params.append(id_perfil)
        query += " ORDER BY id ASC"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def salvar_nova_leitura(
    no_id: str,
    id_perfil: str,
    tensao_kpa: float,
    temp_c: float = 25.0,
    bateria_mv: int = 3300,
    dia_label: str = "Ao Vivo",
    is_simulado: int = 0
) -> Dict[str, Any]:
    iso = datetime.now(timezone.utc).isoformat()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO leituras_historicas (
                no_id, id_perfil, dia_label, timestamp_iso, tensao_kpa, temp_c, bateria_mv, is_simulado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (no_id, id_perfil, dia_label, iso, tensao_kpa, temp_c, bateria_mv, is_simulado))
        novo_id = cursor.lastrowid
        conn.commit()

        cursor.execute("SELECT * FROM leituras_historicas WHERE id = ?", (novo_id,))
        return dict(cursor.fetchone())


def registrar_alerta_banco(
    no_id: str,
    id_perfil: str,
    tensao_kpa: float,
    taxa_secagem_kpa_dia: float,
    dias_restantes: float,
    status: str,
    mensagem: str,
    enviado_telegram: int = 1
) -> int:
    iso = datetime.now(timezone.utc).isoformat()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alertas_disparados (
                timestamp_iso, no_id, id_perfil, tensao_kpa,
                taxa_secagem_kpa_dia, dias_restantes, status, mensagem, enviado_telegram
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            iso, no_id, id_perfil, tensao_kpa, taxa_secagem_kpa_dia,
            dias_restantes, status, mensagem, enviado_telegram
        ))
        conn.commit()
        return cursor.lastrowid
