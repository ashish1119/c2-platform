from datetime import datetime, timezone
from typing import Any

from app.integrations.sms.models import SmsAdapterDetectionRaw


def first(payload: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in payload and payload[key] is not None:
            return payload[key]
    return None


def to_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def to_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.isdigit():
            return datetime.fromtimestamp(float(text), tz=timezone.utc)
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_detection(raw: dict[str, Any], default_source_node: str) -> SmsAdapterDetectionRaw:
    source_node = first(raw, ["source_node", "node_id", "node", "sensor_id", "source"]) or default_source_node

    timestamp = to_datetime(first(raw, ["timestamp_utc", "timestamp", "time", "ts", "detected_at"])) or utc_now()

    frequency_hz = to_int(first(raw, ["frequency_hz", "frequency", "freq_hz", "center_frequency_hz"]))
    if frequency_hz is None:
        raise ValueError("Missing frequency field")

    bandwidth_hz = to_int(first(raw, ["bandwidth_hz", "bandwidth", "bw_hz"]))
    if bandwidth_hz is not None and bandwidth_hz <= 0:
        bandwidth_hz = None

    normalized = SmsAdapterDetectionRaw(
        source_node=str(source_node),
        timestamp_utc=timestamp,
        frequency_hz=frequency_hz,
        bandwidth_hz=bandwidth_hz,
        power_dbm=to_float(first(raw, ["power_dbm", "power", "power_level", "level_dbm"])),
        snr_db=to_float(first(raw, ["snr_db", "snr"])),
        modulation=first(raw, ["modulation", "mode", "signal_type"]),
        confidence=to_float(first(raw, ["confidence", "score"])),
        latitude=to_float(first(raw, ["latitude", "lat"])),
        longitude=to_float(first(raw, ["longitude", "lon", "lng"])),
        altitude_m=to_float(first(raw, ["altitude_m", "altitude", "alt"])),
        doa_azimuth_deg=to_float(first(raw, ["doa_azimuth_deg", "doa_deg", "doa", "azimuth_deg", "azimuth"])),
        doa_elevation_deg=to_float(first(raw, ["doa_elevation_deg", "elevation_deg", "elevation"])),
        doa_rmse_deg=to_float(first(raw, ["doa_rmse_deg", "rmse_deg", "bearing_rmse_deg"])),
        raw_payload=raw,
    )

    return normalized
