"""Recência de aquisição, separada de qualidade do resultado e comunicação."""
from datetime import datetime

from ..timeutils import now_utc, parse_utc


def freshness(measured_at: str | None, received_at: str | None, stale_after: int, *, now: datetime, no_data=False, reason: str | None = None) -> dict:
    result = {"status": "unknown", "measured_at": measured_at, "received_at": received_at, "age_seconds": None, "stale_after_seconds": stale_after}
    if no_data:
        result.update(status="no_data", reason=reason or "no_readings")
    elif measured_at is None:
        result["reason"] = reason or "unknown_acquisition_time"
    else:
        age = (now - parse_utc(measured_at)).total_seconds()
        if age < 0:
            result["reason"] = "future_acquisition_time"
        else:
            result.update(status="fresh" if age <= stale_after else "stale", age_seconds=round(age, 3))
    return result
