"""Configuração central; ambiente do processo tem precedência sobre backend/.env."""

import math
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


@dataclass(frozen=True)
class Settings:
    database_path: Path
    sqlite_timeout_seconds: float = 5.0
    cors_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    stale_after_seconds: int = 300
    authorized_telegram_chat_id: str | None = None
    dashboard_url: str | None = None
    notification_lease_seconds: int = 60
    notification_max_attempts: int = 5
    notification_retry_seconds: int = 10

    def __post_init__(self) -> None:
        path = self.database_path.expanduser()
        if not path.is_absolute():
            path = BACKEND_DIR / path
        object.__setattr__(self, "database_path", path.resolve())
        if not math.isfinite(self.sqlite_timeout_seconds) or not 0 < self.sqlite_timeout_seconds <= 30:
            raise ValueError("SQLITE_TIMEOUT_SECONDS deve ser maior que zero e no máximo 30.")
        if type(self.stale_after_seconds) is not int or not 1 <= self.stale_after_seconds <= 604800:
            raise ValueError("STALE_AFTER_SECONDS deve ser inteiro entre 1 e 604800.")
        for name, value, maximum in (("NOTIFICATION_LEASE_SECONDS", self.notification_lease_seconds, 600), ("NOTIFICATION_MAX_ATTEMPTS", self.notification_max_attempts, 20), ("NOTIFICATION_RETRY_SECONDS", self.notification_retry_seconds, 3600)):
            if type(value) is not int or not 1 <= value <= maximum:
                raise ValueError(f"{name} deve ser inteiro entre 1 e {maximum}.")
        if self.authorized_telegram_chat_id is not None and (not isinstance(self.authorized_telegram_chat_id,str) or not re.fullmatch(r"-?[0-9]{1,20}",self.authorized_telegram_chat_id) or int(self.authorized_telegram_chat_id)==0):
            raise ValueError("AUTHORIZED_TELEGRAM_CHAT_ID deve ser um ID numérico não nulo.")
        if self.dashboard_url is not None:
            url = urlsplit(self.dashboard_url)
            if len(self.dashboard_url)>2048 or any(ord(c)<32 for c in self.dashboard_url) or url.scheme not in {"http","https"} or not url.hostname or url.username is not None or url.password is not None:
                raise ValueError("DASHBOARD_URL deve ser uma URL HTTP/HTTPS sem credenciais.")
            try:
                url.port
            except ValueError as exc:
                raise ValueError("Porta inválida em DASHBOARD_URL.") from exc
        for origin in self.cors_origins:
            parsed = urlsplit(origin)
            if (parsed.scheme not in {"http", "https"} or not parsed.hostname
                    or parsed.path or parsed.query or parsed.fragment
                    or parsed.username is not None or parsed.password is not None):
                raise ValueError("CORS_ORIGINS deve conter origens HTTP/HTTPS exatas, sem caminho.")
            try:
                parsed.port
            except ValueError as exc:
                raise ValueError("Porta inválida em CORS_ORIGINS.") from exc


def load_settings(environ: Mapping[str, str] | None = None, env_file: Path | None = None) -> Settings:
    values: dict[str, str] = {}
    # Um mapping explícito permite testar/configurar sem carregar arquivo local.
    if environ is None:
        path = env_file if env_file is not None else BACKEND_DIR / ".env"
        if path.exists():
            from dotenv import dotenv_values
            values.update({k: v for k, v in dotenv_values(path, interpolate=False).items() if v is not None})
        values.update(os.environ)
    else:
        values.update(environ)
    database_path = values.get("DATABASE_PATH", "data/monitoramento.sqlite3").strip()
    if not database_path or database_path == ":memory:":
        raise ValueError("DATABASE_PATH deve indicar um arquivo persistente.")
    try:
        timeout = float(values.get("SQLITE_TIMEOUT_SECONDS", "5"))
    except ValueError as exc:
        raise ValueError("SQLITE_TIMEOUT_SECONDS deve ser um número.") from exc
    origins = tuple(dict.fromkeys(item.strip().rstrip("/") for item in values.get("CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if item.strip()))
    try:
        stale_after = int(values.get("STALE_AFTER_SECONDS", "300"))
    except ValueError as exc:
        raise ValueError("STALE_AFTER_SECONDS deve ser inteiro.") from exc
    try:
        lease = int(values.get("NOTIFICATION_LEASE_SECONDS", "60"))
        attempts = int(values.get("NOTIFICATION_MAX_ATTEMPTS", "5"))
        retry = int(values.get("NOTIFICATION_RETRY_SECONDS", "10"))
    except ValueError as exc:
        raise ValueError("Opções de notificação devem ser inteiros.") from exc
    return Settings(Path(database_path), timeout, origins, stale_after,
        values.get("AUTHORIZED_TELEGRAM_CHAT_ID", "").strip() or None,
        values.get("DASHBOARD_URL", "").strip() or None, lease, attempts, retry)
