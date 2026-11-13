"""Identidade validada no envelope; conteúdo de cada item validado separadamente."""

from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

Identifier = Annotated[str, Field(strict=True, min_length=1, max_length=80, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")]
Counter = Annotated[int, Field(strict=True, ge=0, le=2**63 - 1)]
Version = Annotated[int, Field(strict=True, ge=1, le=2**31 - 1)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReadingIdentity(BaseModel):
    model_config = ConfigDict(extra="allow")
    node_id: Identifier
    node_boot_id: Identifier
    sequence: Counter
    channel_id: Identifier


class ReadingBatch(StrictModel):
    model_config = ConfigDict(extra="forbid", json_schema_extra={"examples": [{
        "schema_version": 1,
        "gateway_id": "gateway-demo-01",
        "readings": [{
            "node_id": "node-demo-01", "node_boot_id": "boot-demo-001", "sequence": 42,
            "sensor_id": "sensor-demo-01", "channel_id": "signal-01",
            "profile_id": "signal-demo", "profile_version": 1,
            "result": {"kind": "numeric", "value": 42.5}, "quality": "valid",
            "source": "simulation", "measured_at": None, "time_quality": "unknown",
            "node_uptime_ms": 420000,
        }],
    }]})
    schema_version: Annotated[int, Field(strict=True, ge=1, le=1)]
    gateway_id: Identifier
    readings: Annotated[list[ReadingIdentity], Field(min_length=1, max_length=32)]


class NumericResult(StrictModel):
    kind: Literal["numeric"]
    value: Annotated[float, Field(strict=True, allow_inf_nan=False)]

    @field_validator("value", mode="before")
    @classmethod
    def require_number(cls, value: Any) -> Any:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Valor numérico deve ser um número, sem coerção de texto ou booleano.")
        return value


class CategoricalResult(StrictModel):
    kind: Literal["categorical"]
    value: Annotated[str, Field(strict=True, min_length=1, max_length=80)]


class BooleanResult(StrictModel):
    kind: Literal["boolean"]
    value: Annotated[bool, Field(strict=True)]


Result = Annotated[NumericResult | CategoricalResult | BooleanResult, Field(discriminator="kind")]


class Reading(ReadingIdentity):
    model_config = ConfigDict(extra="forbid")
    sensor_id: Identifier
    profile_id: Identifier
    profile_version: Version
    result: Result | None
    quality: Literal["valid", "sensor_error"]
    source: Literal["simulation", "physical_sensor"]
    measured_at: AwareDatetime | None
    time_quality: Literal["synchronized", "unknown"]
    node_uptime_ms: Counter

    @field_validator("measured_at", mode="before")
    @classmethod
    def require_iso_date(cls, value: Any) -> Any:
        if value is not None and not isinstance(value, str):
            raise ValueError("Horário deve ser texto ISO 8601 com fuso, ou null.")
        return value

    @model_validator(mode="after")
    def coherent_result_and_time(self) -> "Reading":
        if (self.quality == "valid") != (self.result is not None):
            raise ValueError("Resultado válido deve estar presente; erro de sensor deve ter result=null.")
        if (self.time_quality == "synchronized") != (self.measured_at is not None):
            raise ValueError("Horário sincronizado exige measured_at; horário desconhecido exige null.")
        if self.measured_at is not None:
            self.measured_at = self.measured_at.astimezone(timezone.utc)
        return self


class ReadingReceipt(StrictModel):
    node_id: str
    node_boot_id: str
    sequence: int
    channel_id: str
    status: Literal["accepted", "duplicate", "rejected", "conflict"]
    reading_id: str | None = None
    error_code: str | None = None
    message: str | None = None


class BatchReceipt(StrictModel):
    schema_version: Literal[1] = 1
    gateway_id: str
    results: list[ReadingReceipt]
