from datetime import datetime
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, model_validator

from .readings import Counter, Identifier, StrictModel


class NodeObservation(StrictModel):
    node_id: Identifier
    node_boot_id: Identifier
    node_boot_count: Counter
    last_radio_age_ms: Annotated[int, Field(strict=True, ge=0, le=365 * 86400000)] | None = None


class Heartbeat(StrictModel):
    model_config = ConfigDict(extra="forbid", json_schema_extra={"examples": [{
        "schema_version": 1, "gateway_boot_id": "gateway-boot-demo-001",
        "gateway_boot_count": 0, "sequence": 1,
        "nodes": [{"node_id": "node-demo-01", "node_boot_id": "boot-demo-001", "node_boot_count": 0, "last_radio_age_ms": 1000}],
    }]})
    schema_version: Annotated[int, Field(strict=True, ge=1, le=1)]
    gateway_boot_id: Identifier
    gateway_boot_count: Counter
    sequence: Counter
    nodes: Annotated[list[NodeObservation], Field(max_length=32)]

    @model_validator(mode="after")
    def distinct_nodes(self):
        if len({node.node_id for node in self.nodes}) != len(self.nodes):
            raise ValueError("Cada nó deve aparecer no máximo uma vez por heartbeat.")
        return self


class NodeReceipt(StrictModel):
    node_id: str
    status: Literal["accepted", "ignored"]
    reason: str | None = None


class HeartbeatReceipt(StrictModel):
    gateway_id: str
    status: Literal["accepted", "duplicate", "ignored"]
    last_heartbeat_at: datetime | None
    nodes: list[NodeReceipt]
