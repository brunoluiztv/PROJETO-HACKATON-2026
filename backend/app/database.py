"""SQLite com conexões locais à operação e migrações transacionais numeradas."""

import hashlib
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    checksum: str
    sql: str


def migrations() -> list[Migration]:
    items = []
    for path in sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.sql")):
        raw = path.read_bytes()
        items.append(Migration(int(path.name.split("_", 1)[0]), path.name, hashlib.sha256(raw).hexdigest(), raw.decode("utf-8")))
    if not items or len({m.version for m in items}) != len(items):
        raise RuntimeError("Migrações ausentes ou com versões duplicadas.")
    return items


def execute_migration(connection: sqlite3.Connection, sql: str) -> None:
    # Não usar executescript: ele pode fazer commit implícito fora da transação.
    buffer = ""
    for line in sql.splitlines(keepends=True):
        buffer += line
        if sqlite3.complete_statement(buffer):
            connection.execute(buffer)
            buffer = ""
    if buffer.strip():
        raise RuntimeError("Migração contém instrução incompleta.")


class Database:
    def __init__(self, path: Path, timeout: float = 5.0):
        self.path = path.resolve()
        self.timeout = timeout

    @contextmanager
    def connection(self, *, create: bool = False, readonly: bool = False) -> Iterator[sqlite3.Connection]:
        mode = "ro" if readonly else "rwc" if create else "rw"
        connection = sqlite3.connect(f"{self.path.as_uri()}?mode={mode}", uri=True, timeout=self.timeout, isolation_level=None)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA foreign_keys = ON")
            yield connection
        finally:
            connection.close()

    @contextmanager
    def transaction(self, *, create: bool = False) -> Iterator[sqlite3.Connection]:
        with self.connection(create=create) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                yield connection
                connection.commit()
            except BaseException:
                connection.rollback()
                raise

    def initialize(self) -> int:
        available = migrations()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection(create=True) as connection:
            connection.execute("PRAGMA journal_mode = WAL")
        with self.transaction() as connection:
            connection.execute("""CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                applied_at TEXT NOT NULL
            )""")
            applied = {row["version"]: row for row in connection.execute("SELECT * FROM schema_migrations")}
            known = {m.version: m for m in available}
            for version, row in applied.items():
                if version not in known or row["name"] != known[version].name or row["checksum"] != known[version].checksum:
                    raise RuntimeError("O banco contém uma migração desconhecida ou alterada; confira as versões antes de iniciar.")
            if sorted(applied) != [m.version for m in available[:len(applied)]]:
                raise RuntimeError("Histórico de migrações possui lacunas.")
            for migration in available:
                if migration.version not in applied:
                    execute_migration(connection, migration.sql)
                    connection.execute("INSERT INTO schema_migrations VALUES (?, ?, ?, ?)", (migration.version, migration.name, migration.checksum, utc_now()))
        return available[-1].version
