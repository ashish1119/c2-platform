from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_user_claims, require_permission
from app.integrations.sms.service import get_sms_adapter_health_snapshot, ingest_sms_adapter_batch
from app.schemas import (
    SmsAdapterHealthRead,
    SmsAdapterIngestRequest,
    SmsAdapterIngestResponse,
    SmsDetectionCreate,
    SmsDetectionRead,
    SmsNodeConnectRequest,
    SmsNodeHealthRead,
    SmsSpectrumOccupancyBin,
    SmsThreatAckRequest,
    SmsThreatRead,
    SmsTrackClassifyRequest,
    SmsTrackRead,
)
from app.services.audit_service import write_audit_log
from app.services.sms_service import (
    acknowledge_sms_threat,
    classify_sms_track,
    connect_sms_node,
    create_sms_detection,
    disconnect_sms_node,
    get_sms_node_health,
    get_sms_spectrum_occupancy,
    list_sms_detections,
    list_sms_nodes,
    list_sms_threats,
    list_sms_tracks,
)

router = APIRouter(prefix="/sms", tags=["sms"])


def _parse_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    if bbox is None or not bbox.strip():
        return None

    parts = [part.strip() for part in bbox.split(",")]
    if len(parts) != 4:
        raise HTTPException(status_code=400, detail="bbox must be 'west,south,east,north'")

    try:
        west, south, east, north = [float(part) for part in parts]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="bbox values must be numeric") from exc

    if west >= east or south >= north:
        raise HTTPException(status_code=400, detail="bbox bounds are invalid")

    if west < -180 or east > 180 or south < -90 or north > 90:
        raise HTTPException(status_code=400, detail="bbox must be within lon[-180,180], lat[-90,90]")

    return west, south, east, north


@router.post("/adapter/ingest", response_model=SmsAdapterIngestResponse)
async def adapter_ingest(
    data: SmsAdapterIngestRequest,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "write")),
):
    return await ingest_sms_adapter_batch(data, db)


@router.get("/adapter/health", response_model=SmsAdapterHealthRead)
async def adapter_health(claims: dict = Depends(require_permission("sms", "read"))):
    return get_sms_adapter_health_snapshot()


@router.post("/nodes/{node_id}/connect", response_model=SmsNodeHealthRead)
async def connect_node(
    node_id: str,
    request: SmsNodeConnectRequest,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "write")),
):
    row = await connect_sms_node(node_id, request.metrics, db)
    return row


@router.post("/nodes/{node_id}/disconnect", response_model=SmsNodeHealthRead)
async def disconnect_node(
    node_id: str,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "write")),
):
    row = await disconnect_sms_node(node_id, db)
    return row


@router.get("/nodes", response_model=list[SmsNodeHealthRead])
async def list_nodes(
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "read")),
):
    return await list_sms_nodes(db)


@router.get("/nodes/{node_id}/health", response_model=SmsNodeHealthRead)
async def node_health(
    node_id: str,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "read")),
):
    row = await get_sms_node_health(node_id, db)
    if row is None:
        raise HTTPException(status_code=404, detail="SMS node not found")
    return row


@router.post("/detections", response_model=SmsDetectionRead)
async def create_detection(
    data: SmsDetectionCreate,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "write")),
):
    try:
        row = await create_sms_detection(data, db)
        return row
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/detections", response_model=list[SmsDetectionRead])
async def list_detections(
    from_ts: datetime | None = Query(default=None),
    to_ts: datetime | None = Query(default=None),
    freq_min_hz: int | None = Query(default=None, gt=0),
    freq_max_hz: int | None = Query(default=None, gt=0),
    bbox: str | None = Query(default=None, description="west,south,east,north"),
    source_node: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "read")),
):
    parsed_bbox = _parse_bbox(bbox)
    return await list_sms_detections(
        db=db,
        from_ts=from_ts,
        to_ts=to_ts,
        freq_min_hz=freq_min_hz,
        freq_max_hz=freq_max_hz,
        bbox=parsed_bbox,
        source_node=source_node,
        limit=limit,
    )


@router.get("/tracks", response_model=list[SmsTrackRead])
async def list_tracks(
    active_only: bool = Query(default=True),
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "read")),
):
    return await list_sms_tracks(db=db, active_only=active_only, limit=limit)


@router.get("/threats", response_model=list[SmsThreatRead])
async def list_threats(
    priority: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms_threat", "read")),
):
    return await list_sms_threats(db=db, priority=priority, status=status, limit=limit)


@router.get("/spectrum/occupancy", response_model=list[SmsSpectrumOccupancyBin])
async def spectrum_occupancy(
    window_seconds: int = Query(default=60, ge=5, le=3600),
    limit: int = Query(default=200, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "read")),
):
    rows = await get_sms_spectrum_occupancy(db=db, window_seconds=window_seconds, limit=limit)
    return [
        SmsSpectrumOccupancyBin(
            frequency_hz=row.frequency_hz,
            detection_count=row.detection_count,
            max_power_dbm=row.max_power_dbm,
        )
        for row in rows
    ]


@router.post("/tracks/{track_id}/classify", response_model=SmsTrackRead)
async def classify_track(
    track_id: str,
    payload: SmsTrackClassifyRequest,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms", "write")),
):
    try:
        track = await classify_sms_track(
            db=db,
            track_id=track_id,
            classification=payload.classification,
            threat_level=payload.threat_level,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if track is None:
        raise HTTPException(status_code=404, detail="SMS track not found")

    await write_audit_log(
        db,
        claims.get("sub"),
        "SMS_TRACK_CLASSIFY",
        "sms_track",
        track.id,
        {
            "classification": payload.classification,
            "threat_level": payload.threat_level,
        },
    )
    return track


@router.post("/threats/{threat_id}/ack", response_model=SmsThreatRead)
async def acknowledge_threat(
    threat_id: str,
    payload: SmsThreatAckRequest,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("sms_threat", "write")),
):
    threat = await acknowledge_sms_threat(db=db, threat_id=threat_id, status=payload.status)
    if threat is None:
        raise HTTPException(status_code=404, detail="SMS threat not found")

    await write_audit_log(
        db,
        claims.get("sub"),
        "SMS_THREAT_STATUS_UPDATE",
        "sms_threat",
        threat.id,
        {
            "status": payload.status.upper(),
        },
    )
    return threat
