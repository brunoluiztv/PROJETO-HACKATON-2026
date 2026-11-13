"""Lotes transacionais: erros previstos são individuais; falha do banco reverte o lote."""

import json

from pydantic import ValidationError

from ..database import Database, utc_now
from ..repositories.catalog import find_channel
from ..repositories.readings import acquisition_json, find_reading, insert_reading
from ..schemas.readings import BatchReceipt, Reading, ReadingBatch, ReadingReceipt
from .alert_engine import evaluate_new_readings


def ingest(database: Database, batch: ReadingBatch) -> BatchReceipt:
    results = []
    new_records = []
    received_at = utc_now()
    with database.transaction() as connection:
        for raw in batch.readings:
            identity = {field: getattr(raw, field) for field in ("node_id", "node_boot_id", "sequence", "channel_id")}

            def receipt(status, **fields):
                return ReadingReceipt(**identity, status=status, **fields)

            try:
                reading = Reading.model_validate(raw.model_dump())
            except ValidationError:
                results.append(receipt("rejected", error_code="invalid_reading", message="Campos, resultado ou horários inválidos. Confira o contrato v1."))
                continue
            channel = find_channel(connection, reading.node_id, reading.channel_id)
            if channel is None or channel["gateway_id"] != batch.gateway_id:
                results.append(receipt("rejected", error_code="channel_not_authorized", message="Nó/canal não cadastrado para este gateway."))
                continue
            canonical = acquisition_json(reading)
            existing = find_reading(connection, reading)
            if existing is not None:
                if existing["acquisition_json"] == canonical:
                    results.append(receipt("duplicate", reading_id=existing["id"]))
                else:
                    results.append(receipt("conflict", reading_id=existing["id"], error_code="identity_conflict", message="Identidade já registrada com outro conteúdo de aquisição."))
                continue
            if reading.sensor_id != channel["sensor_id"] or reading.profile_id != channel["profile_id"] or reading.profile_version != channel["profile_version"]:
                results.append(receipt("rejected", error_code="profile_mismatch", message="Sensor ou perfil não corresponde ao canal cadastrado."))
                continue
            profile = json.loads(channel["definition_json"])
            if reading.result is not None:
                if reading.result.kind != channel["kind"]:
                    results.append(receipt("rejected", error_code="result_kind_mismatch", message="Tipo de resultado incompatível com o perfil."))
                    continue
                if reading.result.kind == "categorical" and reading.result.value not in profile["choices"]:
                    results.append(receipt("rejected", error_code="invalid_category", message="Categoria não prevista no perfil."))
                    continue
            identifier = insert_reading(connection, batch.gateway_id, reading, canonical, received_at)
            new_records.append((identifier, reading))
            results.append(receipt("accepted", reading_id=identifier))
        evaluate_new_readings(connection, new_records)
        # Comunicação da central não é horário de coleta ou prova de contato atual com os nós.
        connection.execute("""UPDATE gateways SET last_seen_at=CASE
            WHEN last_seen_at IS NULL OR last_seen_at < ? THEN ? ELSE last_seen_at END WHERE id=?""", (received_at, received_at, batch.gateway_id))
    return BatchReceipt(gateway_id=batch.gateway_id, results=results)
