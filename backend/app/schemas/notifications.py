from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from .readings import Identifier, StrictModel


class Claim(StrictModel):
    worker_id: Identifier
    limit: Annotated[int, Field(strict=True, ge=1, le=20)] = 1


class LeaseAck(StrictModel):
    worker_id: Identifier
    lease_token: Annotated[str, Field(min_length=20, max_length=200)]


class Delivered(LeaseAck):
    telegram_message_id: Annotated[int, Field(strict=True, ge=1, le=2**63-1)]


class Failed(LeaseAck):
    error: Annotated[str, Field(min_length=1, max_length=400)]


class BotConfig(StrictModel):
    authorized_chat_id: str | None
    dashboard_url: str | None
    lease_seconds: int


class ClaimedNotification(StrictModel):
    id: str
    alert_id: str
    event: Literal['opened','resolved']
    chat_id: str
    text: str
    lease_token: str
    lease_expires_at: datetime
    attempt: int


class ClaimResult(StrictModel):
    items: list[ClaimedNotification]


class Settlement(StrictModel):
    id: str
    status: Literal['sent','pending','dead']
    duplicate: bool
    available_at: datetime


class DiagnosticNotification(StrictModel):
    id: str
    alert_id: str
    event: Literal['opened','resolved']
    status: Literal['pending','leased','sent','dead']
    chat_id: str | None
    created_at: datetime
    available_at: datetime
    attempts: int
    leased_by: str | None
    lease_expires_at: datetime | None
    telegram_message_id: int | None
    last_error: str | None
    settled_at: datetime | None


class NotificationList(StrictModel):
    items: list[DiagnosticNotification]
