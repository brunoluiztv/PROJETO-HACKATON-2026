from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from .queries import StoredReading
from .readings import StrictModel


class AgeStatus(StrictModel):
    status: Literal['fresh', 'stale', 'unknown', 'no_data']
    age_seconds: float | None
    stale_after_seconds: int
    reason: str | None = None


class Freshness(AgeStatus):
    measured_at: datetime | None
    received_at: datetime | None


class Contact(AgeStatus):
    observed_at: datetime | None
    reported_at: datetime | None


class RadioContact(Contact):
    time_quality: Literal['estimated', 'unknown']


class Channel(StrictModel):
    channel_id: str
    sensor_id: str
    name: str
    profile_id: str
    profile_version: int
    calibration_id: str | None
    stale_after_seconds: int


class LatestChannel(Channel):
    selection: Literal['no_data', 'reported_session', 'single_session', 'measured_time', 'ambiguous_sessions']
    reading: StoredReading | None
    freshness: Freshness


class LatestReadings(StrictModel):
    node_id: str
    gateway_id: str
    current_boot_id: str | None
    channels: list[LatestChannel]


class HeartbeatState(StrictModel):
    boot_id: str | None
    boot_count: int | None
    sequence: int | None
    received_at: datetime | None


class GatewayDevice(StrictModel):
    id: str
    role: Literal['gateway']
    name: str
    last_seen_at: datetime | None
    communication: Contact
    heartbeat: HeartbeatState


class NodeDevice(StrictModel):
    id: str
    role: Literal['node']
    name: str
    gateway_id: str
    area_id: str
    current_boot_id: str | None
    current_boot_count: int | None
    session_reported_at: datetime | None
    last_radio_seen_at: datetime | None
    radio_contact: RadioContact
    channels: list[Channel]


class Devices(StrictModel):
    items: list[Annotated[GatewayDevice | NodeDevice, Field(discriminator='role')]]
