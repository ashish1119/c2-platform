from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SmsDetection, SmsNodeHealth
from app.schemas import SmsAdapterIngestRequest, SmsAdapterIngestResponse, SmsDetectionCreate


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _first(payload: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in payload and payload[key] is not None:
            return payload[key]
    return None


def _to_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_datetime(value: Any) -> datetime | None:
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


def _normalize_detection(raw: dict[str, Any], default_source_node: str) -> SmsDetectionCreate:
    source_node = _first(raw, ["source_node", "node_id", "node", "sensor_id", "source"]) or default_source_node

    timestamp = _to_datetime(_first(raw, ["timestamp_utc", "timestamp", "time", "ts", "detected_at"])) or _utc_now()

    frequency_hz = _to_int(_first(raw, ["frequency_hz", "frequency", "freq_hz", "center_frequency_hz"]))
    if frequency_hz is None:
        raise ValueError("Missing frequency field")

    bandwidth_hz = _to_int(_first(raw, ["bandwidth_hz", "bandwidth", "bw_hz"]))
    if bandwidth_hz is not None and bandwidth_hz <= 0:
        bandwidth_hz = None

    power_dbm = _to_float(_first(raw, ["power_dbm", "power", "power_level", "level_dbm"]))
    snr_db = _to_float(_first(raw, ["snr_db", "snr"]))
    confidence = _to_float(_first(raw, ["confidence", "score"]))

    latitude = _to_float(_first(raw, ["latitude", "lat"]))
    longitude = _to_float(_first(raw, ["longitude", "lon", "lng"]))
    altitude_m = _to_float(_first(raw, ["altitude_m", "altitude", "alt"]))

    doa_azimuth_deg = _to_float(_first(raw, ["doa_azimuth_deg", "doa_deg", "doa", "azimuth_deg", "azimuth"]))
    doa_elevation_deg = _to_float(_first(raw, ["doa_elevation_deg", "elevation_deg", "elevation"]))
    doa_rmse_deg = _to_float(_first(raw, ["doa_rmse_deg", "rmse_deg", "bearing_rmse_deg"]))

    return SmsDetectionCreate(
        source_node=str(source_node),
        timestamp_utc=timestamp,
        frequency_hz=frequency_hz,
        bandwidth_hz=bandwidth_hz,
        power_dbm=power_dbm,
        snr_db=snr_db,
        modulation=_first(raw, ["modulation", "mode", "signal_type"]),
        confidence=confidence,
        latitude=latitude,
        longitude=longitude,
        altitude_m=altitude_m,
        doa_azimuth_deg=doa_azimuth_deg,
        doa_elevation_deg=doa_elevation_deg,
        doa_rmse_deg=doa_rmse_deg,
        raw_payload=raw,
    )


async def ingest_sms_adapter_batch(request: SmsAdapterIngestRequest, db: AsyncSession) -> SmsAdapterIngestResponse:
    row = await db.execute(select(SmsNodeHealth).where(SmsNodeHealth.source_node == request.source_node))
    node = row.scalar_one_or_none()

    if node is None:
        node = SmsNodeHealth(
            source_node=request.source_node,
            online=True,
            last_heartbeat=_utc_now(),
            metrics=request.metrics or {},
        )
        db.add(node)
    else:
        node.online = True
        node.last_heartbeat = _utc_now()
        if request.metrics:
            merged = dict(node.metrics or {})
            merged.update(request.metrics)
            node.metrics = merged

    accepted = 0
    rejected = 0
    errors: list[str] = []

    for idx, raw in enumerate(request.detections):
        try:
            normalized = _normalize_detection(raw, request.source_node)
            db.add(SmsDetection(**normalized.model_dump()))
            accepted += 1
        except Exception as exc:
            rejected += 1
            errors.append(f"item[{idx}]: {exc}")

    await db.commit()
    await db.refresh(node)

    return SmsAdapterIngestResponse(
        accepted=accepted,
        rejected=rejected,
        errors=errors,
        node_health=node,
    )
