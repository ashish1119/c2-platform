from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_permission
from app.schemas import (
    CrfsAlertRead,
    CrfsEventRead,
    CrfsIngestControlResponse,
    CrfsIngestHealthRead,
    CrfsIngestNodeCreate,
    CrfsIngestNodeRead,
    CrfsIngestNodeUpdate,
    CrfsLocationRead,
    CrfsOperatorDashboardRead,
    CrfsSignalRead,
    CrfsStreamRead,
)
from app.services.crfs_service import (
    create_crfs_ingest_node,
    get_crfs_ingest_node,
    list_crfs_alerts,
    list_crfs_events,
    list_crfs_ingest_nodes,
    list_crfs_locations,
    list_crfs_signals,
    list_crfs_streams,
    update_crfs_ingest_node,
)

router = APIRouter(prefix="/crfs", tags=["crfs"])


@router.get("/health", response_model=CrfsIngestHealthRead)
async def health(request: Request, claims: dict = Depends(require_permission("crfs", "read"))):
    service = getattr(request.app.state, "crfs_ingest_service", None)
    if service is None:
        return CrfsIngestHealthRead(
            enabled=False,
            running=False,
            host="",
            port=0,
            length_endian="big",
            active_connections=0,
            total_connections=0,
            frames_received=0,
            frames_processed=0,
            frames_rejected=0,
            frames_failed=0,
            max_message_bytes=0,
            idle_timeout_seconds=0,
            last_message_at=None,
            last_error=None,
            realtime={},
        )

    return CrfsIngestHealthRead(**service.health_snapshot())


@router.post("/ingest/start", response_model=CrfsIngestControlResponse)
async def start_ingest(request: Request, claims: dict = Depends(require_permission("crfs", "write"))):
    service = getattr(request.app.state, "crfs_ingest_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="CRFS ingest service unavailable")

    await service.enable_ingest()
    return CrfsIngestControlResponse(status="started", health=CrfsIngestHealthRead(**service.health_snapshot()))


@router.post("/ingest/stop", response_model=CrfsIngestControlResponse)
async def stop_ingest(request: Request, claims: dict = Depends(require_permission("crfs", "write"))):
    service = getattr(request.app.state, "crfs_ingest_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="CRFS ingest service unavailable")

    await service.disable_ingest()
    return CrfsIngestControlResponse(status="stopped", health=CrfsIngestHealthRead(**service.health_snapshot()))


@router.get("/streams", response_model=list[CrfsStreamRead])
async def get_streams(
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "read")),
):
    return await list_crfs_streams(db=db, limit=limit)


@router.get("/signals", response_model=list[CrfsSignalRead])
async def get_signals(
    from_ts: datetime | None = Query(default=None),
    to_ts: datetime | None = Query(default=None),
    stream_guid: str | None = Query(default=None),
    origin_guid: str | None = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "read")),
):
    return await list_crfs_signals(
        db=db,
        from_ts=from_ts,
        to_ts=to_ts,
        stream_guid=stream_guid,
        origin_guid=origin_guid,
        limit=limit,
    )


@router.get("/locations", response_model=list[CrfsLocationRead])
async def get_locations(
    from_ts: datetime | None = Query(default=None),
    to_ts: datetime | None = Query(default=None),
    stream_guid: str | None = Query(default=None),
    origin_guid: str | None = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "read")),
):
    return await list_crfs_locations(
        db=db,
        from_ts=from_ts,
        to_ts=to_ts,
        stream_guid=stream_guid,
        origin_guid=origin_guid,
        limit=limit,
    )


@router.get("/events", response_model=list[CrfsEventRead])
async def get_events(
    from_ts: datetime | None = Query(default=None),
    to_ts: datetime | None = Query(default=None),
    stream_guid: str | None = Query(default=None),
    origin_guid: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "read")),
):
    return await list_crfs_events(
        db=db,
        from_ts=from_ts,
        to_ts=to_ts,
        stream_guid=stream_guid,
        origin_guid=origin_guid,
        event_type=event_type,
        limit=limit,
    )


@router.get("/alerts", response_model=list[CrfsAlertRead])
async def get_alerts(
    from_ts: datetime | None = Query(default=None),
    to_ts: datetime | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "read")),
):
    return await list_crfs_alerts(db=db, from_ts=from_ts, to_ts=to_ts, status=status, limit=limit)


@router.get("/dashboard/operator", response_model=CrfsOperatorDashboardRead)
async def operator_dashboard(
    request: Request,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "read")),
):
    service = getattr(request.app.state, "crfs_ingest_service", None)
    realtime_events = service.hub.recent_events(limit=100) if service is not None else []

    streams = await list_crfs_streams(db=db, limit=200)
    signals = await list_crfs_signals(db=db, limit=500)
    locations = await list_crfs_locations(db=db, limit=500)
    events = await list_crfs_events(db=db, limit=500)
    alerts = await list_crfs_alerts(db=db, limit=500)

    return CrfsOperatorDashboardRead(
        streams=streams,
        signals=signals,
        locations=locations,
        events=events,
        alerts=alerts,
        realtime_events=realtime_events,
    )


@router.get("/nodes", response_model=list[CrfsIngestNodeRead])
async def get_nodes(
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "write")),
):
    return await list_crfs_ingest_nodes(db=db, limit=limit)


@router.post("/nodes", response_model=CrfsIngestNodeRead)
async def create_node(
    payload: CrfsIngestNodeCreate,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "write")),
):
    existing = await get_crfs_ingest_node(db=db, node_name=payload.node_name)
    if existing is not None:
        raise HTTPException(status_code=409, detail="CRFS ingest node already exists")

    return await create_crfs_ingest_node(
        db=db,
        node_name=payload.node_name,
        host=payload.host,
        port=payload.port,
        enabled=payload.enabled,
        description=payload.description,
    )


@router.patch("/nodes/{node_name}", response_model=CrfsIngestNodeRead)
async def patch_node(
    node_name: str,
    payload: CrfsIngestNodeUpdate,
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_permission("crfs", "write")),
):
    node = await get_crfs_ingest_node(db=db, node_name=node_name)
    if node is None:
        raise HTTPException(status_code=404, detail="CRFS ingest node not found")

    return await update_crfs_ingest_node(
        db=db,
        node=node,
        host=payload.host,
        port=payload.port,
        enabled=payload.enabled,
        description=payload.description,
    )


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    service = getattr(websocket.app.state, "crfs_ingest_service", None)
    if service is None:
        await websocket.close(code=1013)
        return

    await service.hub.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await service.hub.disconnect(websocket)
    except Exception:
        await service.hub.disconnect(websocket)
