"""Datas UTC conhecidas; ausência de horário permanece explícita."""
from datetime import datetime, timezone


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("Horário deve informar o fuso, por exemplo Z ou -03:00.")
    return parsed.astimezone(timezone.utc)
