from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator

from .readings import Identifier, Reading, StrictModel
from ..timeutils import parse_utc


class StoredReading(Reading):
    id: str
    gateway_id: str
    received_at: datetime


class ReadingPage(StrictModel):
    items: list[StoredReading]
    next_cursor: str | None


class HistoryFilters(StrictModel):
    node_id: Identifier | None = None
    channel_id: Identifier | None = None
    time_quality: Literal["synchronized", "unknown"] | None = None
    source: Literal["simulation", "physical_sensor"] | None = None
    from_at: datetime | None = None
    to_at: datetime | None = None

    @field_validator("from_at", "to_at", mode="before")
    @classmethod
    def known_utc(cls, value):
        if value is None:
            return None
        if not isinstance(value, str) or "T" not in value:
            raise ValueError("Use horário ISO 8601 com data, hora e fuso.")
        return parse_utc(value)

    @model_validator(mode="after")
    def valid_interval(self):
        if self.from_at and self.to_at and self.from_at > self.to_at:
            raise ValueError("from deve ser anterior ou igual a to.")
        if self.time_quality == "unknown" and (self.from_at or self.to_at):
            raise ValueError("Registros com horário desconhecido não podem ser filtrados por aquisição.")
        return self


class PageCursor(StrictModel):
    version: Annotated[int, Field(strict=True, ge=1, le=1)] = 1
    snapshot: Annotated[int, Field(strict=True, ge=0, le=2**63 - 1)]
    key: Annotated[str, Field(max_length=26, pattern=r"^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6})?$")]
    id: Annotated[str, Field(min_length=1, max_length=80)]
    filters: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
