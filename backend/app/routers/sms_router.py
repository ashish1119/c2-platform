from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.integrations.sms.service import ingest_sms_adapter_batch
from app.schemas import (
    SmsAdapterIngestRequest,
    SmsAdapterIngestResponse,
    SmsDetectionCreate,
    SmsDetectionRead,
    SmsNodeConnectRequest,
    SmsNodeHealthRead,
    SmsSpectrumOccupancyBin,
    SmsThreatRead,
    SmsTrackRead,
)
from app.services.sms_service import (
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


@router.post("/adapter/ingest", response_model=SmsAdapterIngestResponse)
async def adapter_ingest(data: SmsAdapterIngestRequest, db: AsyncSession = Depends(get_db)):
    return await ingest_sms_adapter_batch(data, db)


@router.post("/nodes/{node_id}/connect", response_model=SmsNodeHealthRead)
async def connect_node(node_id: str, request: SmsNodeConnectRequest, db: AsyncSession = Depends(get_db)):
    row = await connect_sms_node(node_id, request.metrics, db)
    return row


@router.post("/nodes/{node_id}/disconnect", response_model=SmsNodeHealthRead)
async def disconnect_node(node_id: str, db: AsyncSession = Depends(get_db)):
    row = await disconnect_sms_node(node_id, db)
    return row


@router.get("/nodes", response_model=list[SmsNodeHealthRead])
async def list_nodes(db: AsyncSession = Depends(get_db)):
    return await list_sms_nodes(db)


@router.get("/nodes/{node_id}/health", response_model=SmsNodeHealthRead)
async def node_health(node_id: str, db: AsyncSession = Depends(get_db)):
    row = await get_sms_node_health(node_id, db)
    if row is None:
        raise HTTPException(status_code=404, detail="SMS node not found")
    return row


@router.post("/detections", response_model=SmsDetectionRead)
async def create_detection(data: SmsDetectionCreate, db: AsyncSession = Depends(get_db)):
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
    source_node: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    return await list_sms_detections(
        db=db,
        from_ts=from_ts,
        to_ts=to_ts,
        freq_min_hz=freq_min_hz,
        freq_max_hz=freq_max_hz,
        source_node=source_node,
        limit=limit,
    )


@router.get("/tracks", response_model=list[SmsTrackRead])
async def list_tracks(
    active_only: bool = Query(default=True),
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    return await list_sms_tracks(db=db, active_only=active_only, limit=limit)


@router.get("/threats", response_model=list[SmsThreatRead])
async def list_threats(
    priority: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    return await list_sms_threats(db=db, priority=priority, status=status, limit=limit)


@router.get("/spectrum/occupancy", response_model=list[SmsSpectrumOccupancyBin])
async def spectrum_occupancy(
    window_seconds: int = Query(default=60, ge=5, le=3600),
    limit: int = Query(default=200, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
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
