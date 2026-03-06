from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from geoalchemy2.elements import WKTElement
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.crfs.codec import CrfsDecodedMessage
from app.logging_config import logger
from app.models import Alert, CrfsEvent, CrfsIngestNode, CrfsLocation, CrfsSignal, CrfsStream, RFSignal
from app.services.rf_service import ensure_rf_signal_partition


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, list) and value:
        return _as_float(value[0])
    try:
        return float(str(value))
    except Exception:
        return None


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list) and value:
        return _as_str(value[0])
    text = str(value).strip()
    return text or None


def _resolve_event_type(value: Any) -> str | None:
    text = _as_str(value)
    if text is None:
        return None

    if text.isdigit():
        numeric = int(text)
        if numeric == 100:
            return "MASK_BREAK"
        if numeric == 101:
            return "INTEGRATED_POWER"
        if numeric == 102:
            return "SIGNAL_DETECTION"
        return f"EVENT_{numeric}"

    normalized = text.strip().upper().replace(" ", "_").replace("-", "_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized


def _bearing_delta(previous: float, current: float) -> float:
    diff = abs(current - previous) % 360.0
    if diff > 180.0:
        diff = 360.0 - diff
    return diff


def _confidence_from_snr(snr: float | None) -> float:
    if snr is None:
        return 0.5
    scaled = (snr + 20.0) / 80.0
    if scaled < 0.0:
        return 0.0
    if scaled > 1.0:
        return 1.0
    return scaled


async def process_decoded_message(
    decoded: CrfsDecodedMessage,
    db: AsyncSession,
    power_threshold: float,
    aoa_delta_threshold_deg: float,
    previous_bearing_by_origin: dict[str, float],
    seen_classifications_by_origin: dict[str, set[str]],
) -> dict[str, Any]:
    telemetry = decoded.telemetry

    stream_guid = decoded.stream_guid or "UNKNOWN_STREAM"
    origin_guid = decoded.origin_guid or "UNKNOWN_ORIGIN"

    await _upsert_stream(
        db=db,
        stream_guid=stream_guid,
        stream_name=decoded.stream_name or decoded.name or stream_guid,
        color=decoded.stream_color,
    )

    center_frequency = _as_float(telemetry.get("signal_center"))
    bandwidth = _as_float(telemetry.get("signal_bandwidth"))
    power = _as_float(telemetry.get("signal_power"))
    snr = _as_float(telemetry.get("signal_snr"))
    modulation = _as_str(telemetry.get("modulation")) or "UNKNOWN"

    latitude = _as_float(telemetry.get("location_latitude"))
    longitude = _as_float(telemetry.get("location_longitude"))
    altitude = _as_float(telemetry.get("location_altitude"))
    speed = _as_float(telemetry.get("location_speed"))

    aoa_bearing = _as_float(telemetry.get("aoa_bearing"))
    aoa_elevation = _as_float(telemetry.get("aoa_elevation"))
    classification = _as_str(telemetry.get("classification"))

    event_type = _resolve_event_type(telemetry.get("event_type"))
    event_frequency_center = _as_float(telemetry.get("event_frequency_center"))
    event_frequency_span = _as_float(telemetry.get("event_frequency_span"))
    event_power = _as_float(telemetry.get("event_power"))

    timestamp = decoded.timestamp
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    signal_created = False
    location_created = False
    event_created = False
    alerts_created = 0
    rf_signal_payload: dict[str, Any] | None = None

    if any(value is not None for value in (center_frequency, bandwidth, power, snr, aoa_bearing, aoa_elevation, classification)):
        signal = CrfsSignal(
            timestamp=timestamp,
            center_frequency=center_frequency,
            bandwidth=bandwidth,
            power=power,
            snr=snr,
            origin_guid=origin_guid,
            stream_guid=stream_guid,
            modulation=modulation,
            classification=classification,
            aoa_bearing=aoa_bearing,
            aoa_elevation=aoa_elevation,
        )
        db.add(signal)
        signal_created = True

        if center_frequency is not None and power is not None and latitude is not None and longitude is not None:
            rf_signal_payload = {
                "frequency": center_frequency,
                "modulation": modulation,
                "power_level": power,
                "bandwidth_hz": bandwidth,
                "confidence": _confidence_from_snr(snr),
                "doa_deg": aoa_bearing,
                "location": WKTElement(f"POINT({longitude} {latitude})", srid=4326),
                "detected_at": timestamp,
            }

    if latitude is not None and longitude is not None:
        location = CrfsLocation(
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            speed=speed,
            timestamp=timestamp,
            origin_guid=origin_guid,
            stream_guid=stream_guid,
        )
        db.add(location)
        location_created = True

    if any(value is not None for value in (event_type, event_frequency_center, event_frequency_span, event_power)):
        event = CrfsEvent(
            event_type=event_type or "UNKNOWN",
            frequency_center=event_frequency_center,
            frequency_span=event_frequency_span,
            power=event_power,
            timestamp=timestamp,
            origin_guid=origin_guid,
            stream_guid=stream_guid,
            payload_json={
                "name": decoded.name,
                "telemetry": telemetry,
                "arrays": list(decoded.arrays.keys()),
                "embedded_count": len(decoded.embedded_data),
            },
        )
        db.add(event)
        event_created = True

    if power is not None and power > power_threshold:
        db.add(
            _build_alert(
                alert_name="CRFS Signal Power Threshold",
                alert_type="CRFS_SIGNAL_POWER",
                severity="HIGH",
                description=(
                    f"Power {power:.2f} dBm exceeded threshold {power_threshold:.2f} dBm"
                    f" | stream={stream_guid} origin={origin_guid}"
                ),
                latitude=latitude,
                longitude=longitude,
            )
        )
        alerts_created += 1

    if event_type == "MASK_BREAK":
        db.add(
            _build_alert(
                alert_name="CRFS Mask Break",
                alert_type="CRFS_MASK_BREAK",
                severity="HIGH",
                description=f"Mask break detected | stream={stream_guid} origin={origin_guid}",
                latitude=latitude,
                longitude=longitude,
            )
        )
        alerts_created += 1

    if aoa_bearing is not None:
        previous = previous_bearing_by_origin.get(origin_guid)
        previous_bearing_by_origin[origin_guid] = aoa_bearing
        if previous is not None:
            delta = _bearing_delta(previous, aoa_bearing)
            if delta >= aoa_delta_threshold_deg:
                db.add(
                    _build_alert(
                        alert_name="CRFS AOA Bearing Change",
                        alert_type="CRFS_AOA_DELTA",
                        severity="MEDIUM",
                        description=(
                            f"AOA bearing changed by {delta:.2f}°"
                            f" | previous={previous:.2f} current={aoa_bearing:.2f}"
                            f" | stream={stream_guid} origin={origin_guid}"
                        ),
                        latitude=latitude,
                        longitude=longitude,
                    )
                )
                alerts_created += 1

    if classification:
        normalized_classification = classification.strip().upper()
        seen = seen_classifications_by_origin.setdefault(origin_guid, set())
        if normalized_classification not in seen:
            seen.add(normalized_classification)
            db.add(
                _build_alert(
                    alert_name="CRFS New Classification",
                    alert_type="CRFS_NEW_CLASSIFICATION",
                    severity="MEDIUM",
                    description=(
                        f"New classification {normalized_classification}"
                        f" | stream={stream_guid} origin={origin_guid}"
                    ),
                    latitude=latitude,
                    longitude=longitude,
                )
            )
            alerts_created += 1

    await db.commit()

    if rf_signal_payload is not None:
        try:
            await ensure_rf_signal_partition(db, rf_signal_payload.get("detected_at"))
            db.add(RFSignal(**rf_signal_payload))
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.warning(f"CRFS RF mirror insert skipped: {exc}")

    return {
        "stream_guid": stream_guid,
        "origin_guid": origin_guid,
        "timestamp": timestamp.isoformat(),
        "signal_created": signal_created,
        "location_created": location_created,
        "event_created": event_created,
        "alerts_created": alerts_created,
        "summary": {
            "frequency": center_frequency,
            "bandwidth": bandwidth,
            "power": power,
            "snr": snr,
            "latitude": latitude,
            "longitude": longitude,
            "event_type": event_type,
            "classification": classification,
        },
    }


async def _upsert_stream(db: AsyncSession, stream_guid: str, stream_name: str | None, color: int | None) -> None:
    row = await db.execute(select(CrfsStream).where(CrfsStream.stream_guid == stream_guid))
    stream = row.scalar_one_or_none()

    if stream is None:
        stream = CrfsStream(
            stream_guid=stream_guid,
            stream_name=stream_name,
            color=color,
        )
        db.add(stream)
        await db.flush()
        return

    changed = False
    if stream_name and stream.stream_name != stream_name:
        stream.stream_name = stream_name
        changed = True
    if color is not None and stream.color != color:
        stream.color = color
        changed = True
    if changed:
        stream.updated_at = _now_utc()


def _build_alert(
    alert_name: str,
    alert_type: str,
    severity: str,
    description: str,
    latitude: float | None,
    longitude: float | None,
) -> Alert:
    location = None
    if latitude is not None and longitude is not None:
        location = WKTElement(f"POINT({longitude} {latitude})", srid=4326)

    return Alert(
        alert_name=alert_name,
        alert_type=alert_type,
        severity=severity,
        status="NEW",
        description=description,
        location=location,
    )


async def list_crfs_streams(db: AsyncSession, limit: int = 500) -> list[CrfsStream]:
    rows = await db.execute(
        select(CrfsStream)
        .order_by(desc(CrfsStream.updated_at), desc(CrfsStream.created_at))
        .limit(max(1, min(limit, 5000)))
    )
    return rows.scalars().all()


async def list_crfs_signals(
    db: AsyncSession,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    stream_guid: str | None = None,
    origin_guid: str | None = None,
    limit: int = 1000,
) -> list[CrfsSignal]:
    stmt = select(CrfsSignal)
    if from_ts is not None:
        stmt = stmt.where(CrfsSignal.timestamp >= from_ts)
    if to_ts is not None:
        stmt = stmt.where(CrfsSignal.timestamp <= to_ts)
    if stream_guid:
        stmt = stmt.where(CrfsSignal.stream_guid == stream_guid)
    if origin_guid:
        stmt = stmt.where(CrfsSignal.origin_guid == origin_guid)

    stmt = stmt.order_by(desc(CrfsSignal.timestamp), desc(CrfsSignal.id)).limit(max(1, min(limit, 5000)))
    rows = await db.execute(stmt)
    return rows.scalars().all()


async def list_crfs_locations(
    db: AsyncSession,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    stream_guid: str | None = None,
    origin_guid: str | None = None,
    limit: int = 1000,
) -> list[CrfsLocation]:
    stmt = select(CrfsLocation)
    if from_ts is not None:
        stmt = stmt.where(CrfsLocation.timestamp >= from_ts)
    if to_ts is not None:
        stmt = stmt.where(CrfsLocation.timestamp <= to_ts)
    if stream_guid:
        stmt = stmt.where(CrfsLocation.stream_guid == stream_guid)
    if origin_guid:
        stmt = stmt.where(CrfsLocation.origin_guid == origin_guid)

    stmt = stmt.order_by(desc(CrfsLocation.timestamp), desc(CrfsLocation.id)).limit(max(1, min(limit, 5000)))
    rows = await db.execute(stmt)
    return rows.scalars().all()


async def list_crfs_events(
    db: AsyncSession,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    stream_guid: str | None = None,
    origin_guid: str | None = None,
    event_type: str | None = None,
    limit: int = 1000,
) -> list[CrfsEvent]:
    stmt = select(CrfsEvent)
    if from_ts is not None:
        stmt = stmt.where(CrfsEvent.timestamp >= from_ts)
    if to_ts is not None:
        stmt = stmt.where(CrfsEvent.timestamp <= to_ts)
    if stream_guid:
        stmt = stmt.where(CrfsEvent.stream_guid == stream_guid)
    if origin_guid:
        stmt = stmt.where(CrfsEvent.origin_guid == origin_guid)
    if event_type:
        stmt = stmt.where(CrfsEvent.event_type == event_type)

    stmt = stmt.order_by(desc(CrfsEvent.timestamp), desc(CrfsEvent.id)).limit(max(1, min(limit, 5000)))
    rows = await db.execute(stmt)
    return rows.scalars().all()


async def list_crfs_alerts(
    db: AsyncSession,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    status: str | None = None,
    limit: int = 1000,
) -> list[Alert]:
    stmt = select(Alert).where(Alert.alert_type.like("CRFS_%"))
    if from_ts is not None:
        stmt = stmt.where(Alert.created_at >= from_ts)
    if to_ts is not None:
        stmt = stmt.where(Alert.created_at <= to_ts)
    if status:
        stmt = stmt.where(Alert.status == status)

    stmt = stmt.order_by(desc(Alert.created_at)).limit(max(1, min(limit, 5000)))
    rows = await db.execute(stmt)
    return rows.scalars().all()


async def list_crfs_ingest_nodes(db: AsyncSession, limit: int = 500) -> list[CrfsIngestNode]:
    rows = await db.execute(
        select(CrfsIngestNode)
        .order_by(desc(CrfsIngestNode.updated_at), desc(CrfsIngestNode.created_at))
        .limit(max(1, min(limit, 5000)))
    )
    return rows.scalars().all()


async def get_crfs_ingest_node(db: AsyncSession, node_name: str) -> CrfsIngestNode | None:
    row = await db.execute(select(CrfsIngestNode).where(CrfsIngestNode.node_name == node_name))
    return row.scalar_one_or_none()


async def create_crfs_ingest_node(
    db: AsyncSession,
    node_name: str,
    host: str,
    port: int,
    enabled: bool,
    description: str | None,
) -> CrfsIngestNode:
    node = CrfsIngestNode(
        node_name=node_name,
        host=host,
        port=port,
        enabled=enabled,
        description=description,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


async def update_crfs_ingest_node(
    db: AsyncSession,
    node: CrfsIngestNode,
    host: str | None,
    port: int | None,
    enabled: bool | None,
    description: str | None,
) -> CrfsIngestNode:
    if host is not None:
        node.host = host
    if port is not None:
        node.port = port
    if enabled is not None:
        node.enabled = enabled
    if description is not None:
        node.description = description

    node.updated_at = _now_utc()
    await db.commit()
    await db.refresh(node)
    return node
