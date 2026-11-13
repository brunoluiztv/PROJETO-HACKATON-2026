from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator

from .readings import Identifier, StrictModel, Version
from .queries import StoredReading

FiniteNumber = Annotated[float, Field(strict=True, allow_inf_nan=False)]
PositiveCount = Annotated[int, Field(strict=True, ge=1, le=100)]


class AlertRule(StrictModel):
    id: Identifier
    label: Annotated[str, Field(min_length=1, max_length=160)]
    node_id: Identifier
    channel_id: Identifier
    profile_id: Identifier
    profile_version: Version
    source: Literal['simulation', 'physical_sensor']
    direction: Literal['below', 'above']
    threshold: FiniteNumber
    recovery_threshold: FiniteNumber
    consecutive: PositiveCount = 3
    recovery_consecutive: PositiveCount = 3
    max_gap_seconds: Annotated[int, Field(strict=True, ge=1, le=604800)] = 300
    max_age_seconds: Annotated[int, Field(strict=True, ge=1, le=604800)] = 300
    cooldown_seconds: Annotated[int, Field(strict=True, ge=0, le=604800)] = 0
    experimental: Annotated[bool, Field(strict=True)] = True
    enabled: Annotated[bool, Field(strict=True)] = True

    @field_validator('threshold', 'recovery_threshold', mode='before')
    @classmethod
    def numeric_threshold(cls, value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError('Limiar deve ser numérico, sem coerção de texto ou booleano.')
        return value

    @model_validator(mode='after')
    def hysteresis(self):
        if self.direction == 'below' and self.recovery_threshold <= self.threshold:
            raise ValueError('Recuperação deve ficar acima do limiar de abertura.')
        if self.direction == 'above' and self.recovery_threshold >= self.threshold:
            raise ValueError('Recuperação deve ficar abaixo do limiar de abertura.')
        return self


class RuleState(StrictModel):
    node_boot_id: str | None
    last_sequence: int | None
    last_reading_id: str | None
    last_measured_at: datetime | None
    breach_count: int
    recovery_count: int
    active_alert_id: str | None
    last_outcome: str


class RuleWithState(AlertRule):
    state: RuleState


class RuleList(StrictModel):
    items: list[RuleWithState]


class DeliveryStatus(StrictModel):
    event: Literal['opened','resolved']
    status: Literal['pending','leased','sent','dead']
    attempts: int
    available_at: datetime
    settled_at: datetime | None


class AlertRecord(StrictModel):
    id: str
    rule_id: str
    node_id: str
    channel_id: str
    status: Literal['active','resolved']
    opened_at: datetime
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    rule: AlertRule
    rule_enabled: bool
    opening_reading: StoredReading
    recovery_reading: StoredReading | None
    notifications: list[DeliveryStatus]


class AlertPage(StrictModel):
    items: list[AlertRecord]
    next_cursor: str | None


class EvaluationCount(StrictModel):
    outcome: str
    count: int


class EvaluationSummary(StrictModel):
    items: list[EvaluationCount]
