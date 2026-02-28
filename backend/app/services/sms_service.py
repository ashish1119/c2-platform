from datetime import datetime, timedelta, timezone
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import SmsDetection, SmsNodeHealth, SmsThreat, SmsTrack


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def connect_sms_node(source_node: str, metrics: dict, db: AsyncSession):
    row = await db.execute(select(SmsNodeHealth).where(SmsNodeHealth.source_node == source_node))
    node = row.scalar_one_or_none()
    if node is None:
        node = SmsNodeHealth(
            source_node=source_node,
            online=True,
            last_heartbeat=_utc_now(),
            metrics=metrics or {},
        )
        db.add(node)
    else:
        node.online = True
        node.last_heartbeat = _utc_now()
        node.metrics = metrics or node.metrics or {}

    await db.commit()
    await db.refresh(node)
    return node


async def disconnect_sms_node(source_node: str, db: AsyncSession):
    row = await db.execute(select(SmsNodeHealth).where(SmsNodeHealth.source_node == source_node))
    node = row.scalar_one_or_none()
    if node is None:
        node = SmsNodeHealth(
            source_node=source_node,
            online=False,
            last_heartbeat=_utc_now(),
            metrics={},
        )
        db.add(node)
    else:
        node.online = False
        node.last_heartbeat = _utc_now()

    await db.commit()
    await db.refresh(node)
    return node


async def list_sms_nodes(db: AsyncSession):
    rows = await db.execute(select(SmsNodeHealth).order_by(desc(SmsNodeHealth.last_heartbeat)))
    return rows.scalars().all()


async def get_sms_node_health(source_node: str, db: AsyncSession):
    row = await db.execute(select(SmsNodeHealth).where(SmsNodeHealth.source_node == source_node))
    return row.scalar_one_or_none()


async def create_sms_detection(data, db: AsyncSession):
    payload = data.model_dump()

    lat = payload.get("latitude")
    lon = payload.get("longitude")
    if (lat is None) != (lon is None):
        raise ValueError("latitude and longitude must both be provided or both omitted")

    detection = SmsDetection(**payload)
    db.add(detection)

    node_row = await db.execute(select(SmsNodeHealth).where(SmsNodeHealth.source_node == data.source_node))
    node = node_row.scalar_one_or_none()
    if node is None:
        node = SmsNodeHealth(
            source_node=data.source_node,
            online=True,
            last_heartbeat=_utc_now(),
            metrics={},
        )
        db.add(node)
    else:
        node.online = True
        node.last_heartbeat = _utc_now()

    await db.commit()
    await db.refresh(detection)
    return detection


async def list_sms_detections(
    db: AsyncSession,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    freq_min_hz: int | None = None,
    freq_max_hz: int | None = None,
    bbox: tuple[float, float, float, float] | None = None,
    source_node: str | None = None,
    limit: int = 500,
):
    stmt = select(SmsDetection)

    if from_ts is not None:
        stmt = stmt.where(SmsDetection.timestamp_utc >= from_ts)
    if to_ts is not None:
        stmt = stmt.where(SmsDetection.timestamp_utc <= to_ts)
    if freq_min_hz is not None:
        stmt = stmt.where(SmsDetection.frequency_hz >= freq_min_hz)
    if freq_max_hz is not None:
        stmt = stmt.where(SmsDetection.frequency_hz <= freq_max_hz)
    if bbox is not None:
        west, south, east, north = bbox
        stmt = stmt.where(
            SmsDetection.longitude.is_not(None),
            SmsDetection.latitude.is_not(None),
            SmsDetection.longitude >= west,
            SmsDetection.longitude <= east,
            SmsDetection.latitude >= south,
            SmsDetection.latitude <= north,
        )
    if source_node:
        stmt = stmt.where(SmsDetection.source_node == source_node)

    stmt = stmt.order_by(desc(SmsDetection.timestamp_utc)).limit(max(1, min(limit, 5000)))
    rows = await db.execute(stmt)
    return rows.scalars().all()


async def classify_sms_track(
    db: AsyncSession,
    track_id,
    classification: str,
    threat_level: int | None = None,
):
    row = await db.execute(select(SmsTrack).where(SmsTrack.id == track_id))
    track = row.scalar_one_or_none()
    if track is None:
        return None

    track.classification = classification
    if threat_level is not None:
        track.threat_level = threat_level

    await db.commit()
    await db.refresh(track)
    return track


async def acknowledge_sms_threat(
    db: AsyncSession,
    threat_id,
    status: str = "ACK",
):
    row = await db.execute(select(SmsThreat).where(SmsThreat.id == threat_id))
    threat = row.scalar_one_or_none()
    if threat is None:
        return None

    threat.status = status.upper()
    await db.commit()
    await db.refresh(threat)
    return threat


async def list_sms_tracks(db: AsyncSession, active_only: bool = True, limit: int = 500):
    stmt = select(SmsTrack)
    if active_only:
        cutoff = _utc_now() - timedelta(minutes=5)
        stmt = stmt.where(SmsTrack.last_seen >= cutoff)

    stmt = stmt.order_by(desc(SmsTrack.last_seen)).limit(max(1, min(limit, 5000)))
    rows = await db.execute(stmt)
    return rows.scalars().all()


async def list_sms_threats(
    db: AsyncSession,
    priority: str | None = None,
    status: str | None = None,
    limit: int = 500,
):
    stmt = select(SmsThreat)

    if priority:
        stmt = stmt.where(func.upper(SmsThreat.priority) == priority.upper())
    if status:
        stmt = stmt.where(func.upper(SmsThreat.status) == status.upper())

    stmt = stmt.order_by(desc(SmsThreat.updated_at), desc(SmsThreat.created_at)).limit(max(1, min(limit, 5000)))
    rows = await db.execute(stmt)
    return rows.scalars().all()


async def get_sms_spectrum_occupancy(db: AsyncSession, window_seconds: int = 60, limit: int = 200):
    window_seconds = max(5, min(window_seconds, 3600))
    cutoff = _utc_now() - timedelta(seconds=window_seconds)

    stmt = (
        select(
            SmsDetection.frequency_hz.label("frequency_hz"),
            func.count(SmsDetection.id).label("detection_count"),
            func.max(SmsDetection.power_dbm).label("max_power_dbm"),
        )
        .where(SmsDetection.timestamp_utc >= cutoff)
        .group_by(SmsDetection.frequency_hz)
        .order_by(desc("detection_count"), desc("frequency_hz"))
        .limit(max(1, min(limit, 2000)))
    )

    rows = await db.execute(stmt)
    return rows.all()
