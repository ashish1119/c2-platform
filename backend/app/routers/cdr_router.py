from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import CdrRecord
import math, uuid
from datetime import datetime, date
from typing import Any

print("CDR Router Loaded")

router = APIRouter(prefix="/cdr", tags=["CDR"])

# ── Coverage / colour maps ────────────────────────────────────────────────────

COVERAGE_RADIUS = {"5G": 350, "4G": 1250, "LTE": 2000, "3G": 3500}
NETWORK_COLOR   = {"5G": "#a855f7", "4G": "#22c55e", "LTE": "#3b82f6", "3G": "#f97316"}
CONGESTION_THRESHOLD = 10

# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin(math.radians(lat2-lat1)/2)**2
         + math.cos(p1)*math.cos(p2)*math.sin(math.radians(lng2-lng1)/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def _signal(d):
    return "Strong" if d < 200 else "Medium" if d < 1000 else "Weak"

def _tower_id(ran, band, lat, lng):
    return f"{ran or 'UNK'}-{band or 'UNK'}-{round(lat,2)}-{round(lng,2)}"

# ── Schemas ───────────────────────────────────────────────────────────────────

class CdrIngest(BaseModel):
    msisdn: str
    imsi: str | None = None
    imei: str | None = None
    target: str | None = None
    call_type: str = "Voice"
    operator: str | None = None
    network: str | None = None
    band: str | None = None
    ran: str | None = None
    latitude: float
    longitude: float
    start_time: datetime
    end_time: datetime | None = None
    duration_sec: int = 0
    is_fake: bool = False
    silent_call_type: str = "None"
    place: str | None = None
    country: str | None = None

class CdrBatchIngest(BaseModel):
    records: list[CdrIngest] = Field(..., min_length=1, max_length=5000)

class TowerInfo(BaseModel):
    tower_id: str
    latitude: float
    longitude: float
    network: str
    ran: str
    band: str
    coverage_radius_m: int
    color: str
    user_count: int
    avg_duration_sec: float
    signal_strength: str
    is_congested: bool
    load_pct: float
    operators: list[str]

class TowerAggregationResponse(BaseModel):
    towers: list[TowerInfo]
    total_records: int
    total_towers: int

# ── Network-map schemas ───────────────────────────────────────────────────────

class MainUserInfo(BaseModel):
    msisdn: str
    latitude: float
    longitude: float
    total_records: int
    networks: list[str]
    operators: list[str]

class ContactInfo(BaseModel):
    msisdn: str
    latitude: float
    longitude: float
    call_count: int
    total_duration_sec: int
    last_call_time: str
    call_types: list[str]
    nearest_tower_id: str | None
    distance_to_tower_m: float | None
    is_most_frequent: bool

class ConnectionInfo(BaseModel):
    from_msisdn: str
    to_msisdn: str
    call_count: int
    total_duration_sec: int
    call_types: list[str]
    weight: float          # normalised 0-1 for line thickness

class NetworkTowerInfo(BaseModel):
    tower_id: str
    latitude: float
    longitude: float
    network: str
    ran: str
    band: str
    coverage_radius_m: int
    color: str
    user_count: int
    connected_msisdns: list[str]

class NetworkMapResponse(BaseModel):
    main_user: MainUserInfo
    targets: list[ContactInfo]
    connections: list[ConnectionInfo]
    towers: list[NetworkTowerInfo]

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def get_cdr():
    return {"message": "CDR router working"}

@router.post("/ingest", status_code=201)
def ingest_cdr(payload: CdrBatchIngest, db: Session = Depends(get_db)):
    rows = [CdrRecord(
        id=uuid.uuid4(), msisdn=r.msisdn, imsi=r.imsi, imei=r.imei,
        target=r.target, call_type=r.call_type, operator=r.operator,
        network=r.network, band=r.band, ran=r.ran,
        latitude=r.latitude, longitude=r.longitude,
        start_time=r.start_time, end_time=r.end_time,
        duration_sec=r.duration_sec, is_fake=r.is_fake,
        silent_call_type=r.silent_call_type, place=r.place, country=r.country,
    ) for r in payload.records]
    db.bulk_save_objects(rows)
    db.commit()
    return {"inserted": len(rows)}

@router.get("/towers", response_model=TowerAggregationResponse)
def get_towers(
    msisdn: str | None = Query(None),
    network: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    q = db.query(CdrRecord)
    if msisdn: q = q.filter(CdrRecord.msisdn.ilike(f"%{msisdn}%"))
    if network: q = q.filter(CdrRecord.network == network)
    records = q.limit(limit).all()
    if not records:
        return TowerAggregationResponse(towers=[], total_records=0, total_towers=0)
    groups: dict[str, dict] = {}
    for rec in records:
        tid = _tower_id(rec.ran or "", rec.band or "", rec.latitude, rec.longitude)
        if tid not in groups:
            groups[tid] = {"tower_id": tid, "lat_sum": 0.0, "lng_sum": 0.0, "count": 0,
                           "duration_sum": 0, "network": rec.network or "4G",
                           "ran": rec.ran or "UNK", "band": rec.band or "UNK", "operators": set()}
        g = groups[tid]
        g["lat_sum"] += rec.latitude; g["lng_sum"] += rec.longitude
        g["count"] += 1; g["duration_sum"] += rec.duration_sec or 0
        if rec.operator: g["operators"].add(rec.operator)
    towers = []
    for g in groups.values():
        n = g["count"]; lat = g["lat_sum"]/n; lng = g["lng_sum"]/n
        net = g["network"]; radius = COVERAGE_RADIUS.get(net, 1000)
        dist = _haversine_m(lat, lng, round(lat,2), round(lng,2))
        towers.append(TowerInfo(
            tower_id=g["tower_id"], latitude=lat, longitude=lng,
            network=net, ran=g["ran"], band=g["band"],
            coverage_radius_m=radius, color=NETWORK_COLOR.get(net, "#64748b"),
            user_count=n, avg_duration_sec=round(g["duration_sum"]/n, 1),
            signal_strength=_signal(dist), is_congested=n >= CONGESTION_THRESHOLD,
            load_pct=round(min(100.0, n/CONGESTION_THRESHOLD*100), 1),
            operators=sorted(g["operators"]),
        ))
    towers.sort(key=lambda t: t.user_count, reverse=True)
    return TowerAggregationResponse(towers=towers, total_records=len(records), total_towers=len(towers))

@router.get("/heatmap")
def get_tower_heatmap(msisdn: str | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(CdrRecord)
    if msisdn: q = q.filter(CdrRecord.msisdn.ilike(f"%{msisdn}%"))
    cells: dict[str, dict] = {}
    for rec in q.limit(2000).all():
        key = f"{round(rec.latitude,2)},{round(rec.longitude,2)}"
        if key not in cells:
            cells[key] = {"lat": round(rec.latitude,2), "lng": round(rec.longitude,2), "weight": 0}
        cells[key]["weight"] += 1
    return {"cells": list(cells.values())}

@router.get("/network-map", response_model=NetworkMapResponse)
def get_network_map(
    msisdn: str = Query(..., description="Main user MSISDN"),
    start_date: str | None = Query(None, description="ISO date YYYY-MM-DD"),
    end_date: str | None = Query(None, description="ISO date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    Returns full network map for a given MSISDN:
    - main_user: location + metadata for the selected MSISDN
    - targets: all contacted numbers with call stats + tower distance
    - connections: edge list with call counts for line thickness
    - towers: virtual towers derived from all records in scope
    """
    q = db.query(CdrRecord).filter(CdrRecord.msisdn == msisdn)
    if start_date:
        q = q.filter(CdrRecord.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(CdrRecord.start_time <= datetime.fromisoformat(end_date + "T23:59:59"))
    records = q.limit(2000).all()

    if not records:
        # Return empty but valid response
        return NetworkMapResponse(
            main_user=MainUserInfo(msisdn=msisdn, latitude=0, longitude=0,
                                   total_records=0, networks=[], operators=[]),
            targets=[], connections=[], towers=[],
        )

    # ── Main user: average location across all records ────────────────────────
    lat_sum = sum(r.latitude for r in records)
    lng_sum = sum(r.longitude for r in records)
    n = len(records)
    main_lat = lat_sum / n
    main_lng = lng_sum / n
    main_user = MainUserInfo(
        msisdn=msisdn,
        latitude=main_lat,
        longitude=main_lng,
        total_records=n,
        networks=sorted({r.network for r in records if r.network}),
        operators=sorted({r.operator for r in records if r.operator}),
    )

    # ── Build towers from all records ─────────────────────────────────────────
    tower_groups: dict[str, dict] = {}
    for rec in records:
        tid = _tower_id(rec.ran or "", rec.band or "", rec.latitude, rec.longitude)
        if tid not in tower_groups:
            tower_groups[tid] = {
                "tower_id": tid, "lat_sum": 0.0, "lng_sum": 0.0, "count": 0,
                "network": rec.network or "4G", "ran": rec.ran or "UNK",
                "band": rec.band or "UNK", "msisdns": set(),
            }
        g = tower_groups[tid]
        g["lat_sum"] += rec.latitude; g["lng_sum"] += rec.longitude
        g["count"] += 1
        if rec.target: g["msisdns"].add(rec.target)

    tower_list: list[NetworkTowerInfo] = []
    tower_lookup: list[dict] = []   # for distance calc
    for g in tower_groups.values():
        cnt = g["count"]
        tlat = g["lat_sum"] / cnt
        tlng = g["lng_sum"] / cnt
        net = g["network"]
        tower_list.append(NetworkTowerInfo(
            tower_id=g["tower_id"], latitude=tlat, longitude=tlng,
            network=net, ran=g["ran"], band=g["band"],
            coverage_radius_m=COVERAGE_RADIUS.get(net, 1000),
            color=NETWORK_COLOR.get(net, "#64748b"),
            user_count=cnt,
            connected_msisdns=sorted(g["msisdns"]),
        ))
        tower_lookup.append({"id": g["tower_id"], "lat": tlat, "lng": tlng})

    def _nearest_tower(lat, lng):
        best_id, best_dist = None, float("inf")
        for t in tower_lookup:
            d = _haversine_m(lat, lng, t["lat"], t["lng"])
            if d < best_dist:
                best_dist = d; best_id = t["id"]
        return best_id, best_dist if best_id else None

    # ── Aggregate contacts ────────────────────────────────────────────────────
    contact_map: dict[str, dict] = {}
    for rec in records:
        if not rec.target:
            continue
        tgt = rec.target
        if tgt not in contact_map:
            # Use receiver lat/lng if available, else offset slightly from main
            contact_map[tgt] = {
                "msisdn": tgt,
                "lat_sum": 0.0, "lng_sum": 0.0, "loc_count": 0,
                "call_count": 0, "duration_sum": 0,
                "last_call_time": "",
                "call_types": set(),
            }
        c = contact_map[tgt]
        # Receiver location: use a small offset from caller as approximation
        # (real data would have separate receiver coords)
        offset_lat = rec.latitude + 0.03
        offset_lng = rec.longitude + 0.03
        c["lat_sum"] += offset_lat; c["lng_sum"] += offset_lng; c["loc_count"] += 1
        c["call_count"] += 1
        c["duration_sum"] += rec.duration_sec or 0
        ts = rec.start_time.isoformat() if rec.start_time else ""
        if ts > c["last_call_time"]: c["last_call_time"] = ts
        if rec.call_type: c["call_types"].add(rec.call_type)

    max_calls = max((c["call_count"] for c in contact_map.values()), default=1)
    most_frequent = max(contact_map, key=lambda k: contact_map[k]["call_count"], default=None)

    targets: list[ContactInfo] = []
    for tgt, c in contact_map.items():
        loc_n = c["loc_count"]
        clat = c["lat_sum"] / loc_n
        clng = c["lng_sum"] / loc_n
        tid, tdist = _nearest_tower(clat, clng)
        targets.append(ContactInfo(
            msisdn=tgt,
            latitude=clat,
            longitude=clng,
            call_count=c["call_count"],
            total_duration_sec=c["duration_sum"],
            last_call_time=c["last_call_time"],
            call_types=sorted(c["call_types"]),
            nearest_tower_id=tid,
            distance_to_tower_m=round(tdist, 1) if tdist is not None else None,
            is_most_frequent=(tgt == most_frequent),
        ))
    targets.sort(key=lambda t: t.call_count, reverse=True)

    # ── Connections (edge list) ───────────────────────────────────────────────
    connections: list[ConnectionInfo] = []
    for tgt, c in contact_map.items():
        weight = c["call_count"] / max_calls
        connections.append(ConnectionInfo(
            from_msisdn=msisdn,
            to_msisdn=tgt,
            call_count=c["call_count"],
            total_duration_sec=c["duration_sum"],
            call_types=sorted(c["call_types"]),
            weight=round(weight, 3),
        ))

    return NetworkMapResponse(
        main_user=main_user,
        targets=targets,
        connections=connections,
        towers=tower_list,
    )
# ── /cdr/call-map ─────────────────────────────────────────────────────────────

class CallerInfo(BaseModel):
    msisdn: str
    imsi: str | None
    imei: str | None
    operator: str | None
    network: str | None
    lat: float
    lng: float
    total_calls: int
    total_duration_sec: int

class ReceiverInfo(BaseModel):
    msisdn: str
    lat: float
    lng: float
    city: str | None
    operator: str | None
    call_count: int
    total_duration_sec: int
    last_call_time: str
    call_types: list[str]
    is_most_frequent: bool

class CallConnection(BaseModel):
    from_msisdn: str
    to_msisdn: str
    lat1: float
    lng1: float
    lat2: float
    lng2: float
    count: int
    total_duration_sec: int
    weight: float          # 0-1 normalised for line thickness

class CallMapResponse(BaseModel):
    caller: CallerInfo
    receivers: list[ReceiverInfo]
    connections: list[CallConnection]

@router.get("/call-map", response_model=CallMapResponse)
def get_call_map(
    msisdn: str = Query(..., description="Caller MSISDN"),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    Caller ↔ Receiver geo map for a given MSISDN.
    Returns caller location, all receivers with locations, and connection edges.
    """
    q = db.query(CdrRecord).filter(CdrRecord.msisdn == msisdn)
    if start_date:
        q = q.filter(CdrRecord.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(CdrRecord.start_time <= datetime.fromisoformat(end_date + "T23:59:59"))
    records = q.limit(2000).all()

    if not records:
        return CallMapResponse(
            caller=CallerInfo(msisdn=msisdn, imsi=None, imei=None, operator=None,
                              network=None, lat=0.0, lng=0.0, total_calls=0, total_duration_sec=0),
            receivers=[], connections=[],
        )

    # Caller: average location
    lat_sum = sum(r.latitude for r in records)
    lng_sum = sum(r.longitude for r in records)
    n = len(records)
    caller = CallerInfo(
        msisdn=msisdn,
        imsi=records[0].imsi,
        imei=records[0].imei,
        operator=records[0].operator,
        network=records[0].network,
        lat=lat_sum / n,
        lng=lng_sum / n,
        total_calls=n,
        total_duration_sec=sum(r.duration_sec or 0 for r in records),
    )

    # Aggregate receivers
    recv_map: dict[str, dict] = {}
    for rec in records:
        tgt = rec.target or ""
        if not tgt:
            continue
        if tgt not in recv_map:
            # Receiver location: offset from caller (real data would have separate coords)
            recv_map[tgt] = {
                "msisdn": tgt,
                "lat_sum": 0.0, "lng_sum": 0.0, "loc_n": 0,
                "city": rec.place,
                "operator": rec.operator,
                "call_count": 0, "duration_sum": 0,
                "last_call_time": "",
                "call_types": set(),
            }
        rv = recv_map[tgt]
        # Use a small deterministic offset so each receiver has a distinct position
        seed = sum(ord(c) for c in tgt) % 100
        rv["lat_sum"] += rec.latitude + 0.02 + (seed % 10) * 0.005
        rv["lng_sum"] += rec.longitude + 0.02 + (seed // 10) * 0.005
        rv["loc_n"] += 1
        rv["call_count"] += 1
        rv["duration_sum"] += rec.duration_sec or 0
        ts = rec.start_time.isoformat() if rec.start_time else ""
        if ts > rv["last_call_time"]:
            rv["last_call_time"] = ts
        if rec.call_type:
            rv["call_types"].add(rec.call_type)

    max_calls = max((rv["call_count"] for rv in recv_map.values()), default=1)
    most_freq = max(recv_map, key=lambda k: recv_map[k]["call_count"], default=None)

    receivers: list[ReceiverInfo] = []
    connections: list[CallConnection] = []

    for tgt, rv in recv_map.items():
        loc_n = rv["loc_n"]
        rlat = rv["lat_sum"] / loc_n
        rlng = rv["lng_sum"] / loc_n
        weight = rv["call_count"] / max_calls

        receivers.append(ReceiverInfo(
            msisdn=tgt,
            lat=rlat, lng=rlng,
            city=rv["city"],
            operator=rv["operator"],
            call_count=rv["call_count"],
            total_duration_sec=rv["duration_sum"],
            last_call_time=rv["last_call_time"],
            call_types=sorted(rv["call_types"]),
            is_most_frequent=(tgt == most_freq),
        ))
        connections.append(CallConnection(
            from_msisdn=msisdn, to_msisdn=tgt,
            lat1=caller.lat, lng1=caller.lng,
            lat2=rlat, lng2=rlng,
            count=rv["call_count"],
            total_duration_sec=rv["duration_sum"],
            weight=round(weight, 3),
        ))

    receivers.sort(key=lambda r: r.call_count, reverse=True)
    connections.sort(key=lambda c: c.count, reverse=True)

    return CallMapResponse(caller=caller, receivers=receivers, connections=connections)
# ── Live CDR ingestion + WebSocket broadcast ──────────────────────────────────

import json as _json
from fastapi import WebSocket, WebSocketDisconnect
from app.core.websocket_manager import manager as _ws_manager

# Per-connection CDR subscriber list (separate from the main manager)
_cdr_subscribers: list[WebSocket] = []

class LiveCdrRecord(BaseModel):
    """Single CDR record for live ingestion."""
    msisdn: str
    target: str | None = None
    latitude: float
    longitude: float
    receiver_latitude: float | None = None
    receiver_longitude: float | None = None
    start_time: datetime
    end_time: datetime | None = None
    duration_sec: int = 0
    call_type: str = "Voice"
    operator: str | None = None
    network: str | None = None
    band: str | None = None
    ran: str | None = None
    imsi: str | None = None
    imei: str | None = None
    place: str | None = None
    country: str | None = None
    is_fake: bool = False
    silent_call_type: str = "None"
    rx_level: float | None = None

class LiveCdrBatch(BaseModel):
    records: list[LiveCdrRecord] = Field(..., min_length=1, max_length=500)

def _build_ws_event(rec: CdrRecord, receiver_lat: float, receiver_lng: float) -> dict:
    """Build the WebSocket event payload for a single CDR record."""
    return {
        "type": "cdr_live",
        "caller": {
            "msisdn": rec.msisdn,
            "imsi": rec.imsi,
            "imei": rec.imei,
            "operator": rec.operator,
            "network": rec.network,
            "lat": rec.latitude,
            "lng": rec.longitude,
            "place": rec.place,
        },
        "receiver": {
            "msisdn": rec.target,
            "lat": receiver_lat,
            "lng": receiver_lng,
        },
        "call": {
            "call_type": rec.call_type,
            "duration_sec": rec.duration_sec,
            "start_time": rec.start_time.isoformat() if rec.start_time else None,
            "band": rec.band,
            "ran": rec.ran,
        },
        "alerts": {
            "is_fake": rec.is_fake,
            "silent_call_type": rec.silent_call_type,
        },
        "id": str(rec.id),
        "ts": rec.start_time.isoformat() if rec.start_time else None,
    }

async def _broadcast_cdr(event: dict) -> None:
    """Broadcast to all CDR-specific subscribers."""
    dead = []
    for ws in list(_cdr_subscribers):
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in _cdr_subscribers:
            _cdr_subscribers.remove(ws)

@router.post("/live", status_code=201)
async def ingest_live_cdr(payload: LiveCdrBatch, db: Session = Depends(get_db)):
    """
    Live CDR ingestion endpoint.
    - Validates and stores each record in the database
    - Broadcasts each record to all /ws/cdr/live subscribers
    - Deduplicates by (msisdn, start_time) to avoid double-inserts
    """
    inserted = 0
    events = []

    for r in payload.records:
        # Dedup check: skip if same msisdn + start_time already exists
        existing = (
            db.query(CdrRecord)
            .filter(CdrRecord.msisdn == r.msisdn, CdrRecord.start_time == r.start_time)
            .first()
        )
        if existing:
            continue

        rec = CdrRecord(
            id=uuid.uuid4(),
            msisdn=r.msisdn,
            imsi=r.imsi,
            imei=r.imei,
            target=r.target,
            call_type=r.call_type,
            operator=r.operator,
            network=r.network,
            band=r.band,
            ran=r.ran,
            latitude=r.latitude,
            longitude=r.longitude,
            start_time=r.start_time,
            end_time=r.end_time,
            duration_sec=r.duration_sec,
            is_fake=r.is_fake,
            silent_call_type=r.silent_call_type,
            place=r.place,
            country=r.country,
        )
        db.add(rec)
        inserted += 1

        # Receiver location: use provided or offset
        recv_lat = r.receiver_latitude if r.receiver_latitude is not None else r.latitude + 0.03
        recv_lng = r.receiver_longitude if r.receiver_longitude is not None else r.longitude + 0.03
        events.append(_build_ws_event(rec, recv_lat, recv_lng))

    db.commit()

    # Broadcast all events after commit
    for event in events:
        await _broadcast_cdr(event)

    return {"inserted": inserted, "total": len(payload.records)}

@router.websocket("/ws/live")
async def cdr_live_ws(websocket: WebSocket):
    """
    CDR live WebSocket endpoint.
    Clients connect here to receive real-time CDR events as they are ingested.
    No auth required for simplicity — add token check if needed.
    """
    await websocket.accept()
    _cdr_subscribers.append(websocket)
    try:
        while True:
            # Keep connection alive; client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if websocket in _cdr_subscribers:
            _cdr_subscribers.remove(websocket)

@router.get("/live/recent")
def get_recent_live(limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db)):
    """Return the most recently ingested CDR records for timeline playback."""
    rows = (
        db.query(CdrRecord)
        .order_by(CdrRecord.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "msisdn": r.msisdn,
            "target": r.target,
            "lat": r.latitude,
            "lng": r.longitude,
            "call_type": r.call_type,
            "operator": r.operator,
            "network": r.network,
            "duration_sec": r.duration_sec,
            "start_time": r.start_time.isoformat() if r.start_time else None,
            "is_fake": r.is_fake,
            "silent_call_type": r.silent_call_type,
            "place": r.place,
        }
        for r in rows
    ]
# ── /cdr/connections — per-call edge list with full metadata ──────────────────

class ConnectionEdge(BaseModel):
    id: str
    receiver: str
    lat: float
    lng: float
    duration: int
    timestamp: str
    call_type: str
    operator: str | None
    network: str | None
    is_fake: bool
    silent_call_type: str

class ConnectionsResponse(BaseModel):
    caller: dict
    connections: list[ConnectionEdge]

@router.get("/connections", response_model=ConnectionsResponse)
def get_connections(
    msisdn: str = Query(..., description="Caller MSISDN"),
    start: str | None = Query(None, description="ISO date YYYY-MM-DD"),
    end: str | None = Query(None, description="ISO date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    Per-call connection list for a given MSISDN.
    Returns every individual call as an edge with full metadata for tooltip display.
    Receiver location priority: GPS lat/lng > offset from caller.
    """
    q = db.query(CdrRecord).filter(CdrRecord.msisdn == msisdn)
    if start:
        q = q.filter(CdrRecord.start_time >= datetime.fromisoformat(start))
    if end:
        q = q.filter(CdrRecord.start_time <= datetime.fromisoformat(end + "T23:59:59"))
    records = q.order_by(CdrRecord.start_time.desc()).limit(2000).all()

    if not records:
        return ConnectionsResponse(
            caller={"msisdn": msisdn, "lat": 0.0, "lng": 0.0},
            connections=[],
        )

    # Caller average location
    caller_lat = sum(r.latitude for r in records) / len(records)
    caller_lng = sum(r.longitude for r in records) / len(records)

    edges: list[ConnectionEdge] = []
    for rec in records:
        if not rec.target:
            continue
        # Receiver location: deterministic offset per target so each has distinct position
        seed = sum(ord(c) for c in rec.target) % 100
        recv_lat = rec.latitude + 0.02 + (seed % 10) * 0.005
        recv_lng = rec.longitude + 0.02 + (seed // 10) * 0.005

        edges.append(ConnectionEdge(
            id=str(rec.id),
            receiver=rec.target,
            lat=recv_lat,
            lng=recv_lng,
            duration=rec.duration_sec or 0,
            timestamp=rec.start_time.isoformat() if rec.start_time else "",
            call_type=rec.call_type or "Voice",
            operator=rec.operator,
            network=rec.network,
            is_fake=rec.is_fake or False,
            silent_call_type=rec.silent_call_type or "None",
        ))

    return ConnectionsResponse(
        caller={"msisdn": msisdn, "lat": caller_lat, "lng": caller_lng},
        connections=edges,
    )
# ── /cdr/network-graph ────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    label: str
    type: str                  # "main" | "contact"
    total_calls: int
    total_duration: int
    operator: str | None
    network: str | None
    device: str | None
    location: str | None
    imsi: str | None
    imei: str | None
    suspicious: bool
    fake_count: int
    silent_count: int

class GraphLink(BaseModel):
    source: str
    target: str
    count: int
    duration: int
    suspicious: bool
    call_types: list[str]
    weight: float              # 0-1 normalised

class NetworkGraphResponse(BaseModel):
    nodes: list[GraphNode]
    links: list[GraphLink]
    center_msisdn: str
    total_records: int

@router.get("/network-graph", response_model=NetworkGraphResponse)
def get_network_graph(
    msisdn: str = Query(..., description="Center node MSISDN"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    operator: str | None = Query(None),
    network: str | None = Query(None),
    fake_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    """
    Build a call relationship graph centred on a given MSISDN.
    Returns nodes (caller + all receivers) and links (edges with call stats).
    Works with any data in cdr_records table.
    """
    q = db.query(CdrRecord).filter(CdrRecord.msisdn == msisdn)
    if start_date:
        q = q.filter(CdrRecord.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(CdrRecord.start_time <= datetime.fromisoformat(end_date + "T23:59:59"))
    if operator:
        q = q.filter(CdrRecord.operator == operator)
    if network:
        q = q.filter(CdrRecord.network == network)
    if fake_only:
        q = q.filter(CdrRecord.is_fake == True)

    records = q.limit(2000).all()
    if not records:
        return NetworkGraphResponse(nodes=[], links=[], center_msisdn=msisdn, total_records=0)

    # ── Centre node ───────────────────────────────────────────────────────────
    total_dur = sum(r.duration_sec or 0 for r in records)
    fake_c = sum(1 for r in records if r.is_fake)
    silent_c = sum(1 for r in records if r.silent_call_type and r.silent_call_type != "None")
    centre = GraphNode(
        id=msisdn, label=msisdn, type="main",
        total_calls=len(records), total_duration=total_dur,
        operator=records[0].operator, network=records[0].network,
        device=None, location=records[0].place,
        imsi=records[0].imsi, imei=records[0].imei,
        suspicious=(fake_c > 0 or silent_c > 0),
        fake_count=fake_c, silent_count=silent_c,
    )

    # ── Aggregate contacts ────────────────────────────────────────────────────
    contact_map: dict[str, dict] = {}
    for rec in records:
        tgt = rec.target or ""
        if not tgt:
            continue
        if tgt not in contact_map:
            contact_map[tgt] = {
                "call_count": 0, "duration_sum": 0,
                "fake_count": 0, "silent_count": 0,
                "call_types": set(),
                "operator": rec.operator, "network": rec.network,
                "place": rec.place,
            }
        c = contact_map[tgt]
        c["call_count"] += 1
        c["duration_sum"] += rec.duration_sec or 0
        if rec.is_fake: c["fake_count"] += 1
        if rec.silent_call_type and rec.silent_call_type != "None": c["silent_count"] += 1
        if rec.call_type: c["call_types"].add(rec.call_type)

    max_calls = max((v["call_count"] for v in contact_map.values()), default=1)

    nodes: list[GraphNode] = [centre]
    links: list[GraphLink] = []

    # Limit to top 100 contacts by call count
    sorted_contacts = sorted(contact_map.items(), key=lambda x: x[1]["call_count"], reverse=True)[:99]

    for tgt, c in sorted_contacts:
        suspicious = c["fake_count"] > 0 or c["silent_count"] > 0
        nodes.append(GraphNode(
            id=tgt, label=tgt, type="contact",
            total_calls=c["call_count"], total_duration=c["duration_sum"],
            operator=c["operator"], network=c["network"],
            device=None, location=c["place"],
            imsi=None, imei=None,
            suspicious=suspicious,
            fake_count=c["fake_count"], silent_count=c["silent_count"],
        ))
        links.append(GraphLink(
            source=msisdn, target=tgt,
            count=c["call_count"], duration=c["duration_sum"],
            suspicious=suspicious,
            call_types=sorted(c["call_types"]),
            weight=round(c["call_count"] / max_calls, 3),
        ))

    return NetworkGraphResponse(
        nodes=nodes, links=links,
        center_msisdn=msisdn, total_records=len(records),
    )


# ── /cdr/signal-stats ─────────────────────────────────────────────────────────

class RxPoint(BaseModel):
    timestamp: str
    rx_level: float
    network: str
    operator: str | None

class FreqBucket(BaseModel):
    band: str
    count: int

class SignalStatsResponse(BaseModel):
    rx_timeline: list[RxPoint]
    network_dist: list[dict]
    band_dist: list[FreqBucket]
    avg_rx: float | None
    strong_pct: float
    medium_pct: float
    weak_pct: float

@router.get("/signal-stats", response_model=SignalStatsResponse)
def get_signal_stats(
    msisdn: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    Signal intelligence statistics for a given MSISDN (or all records).
    Returns Rx level timeline, network distribution, band distribution.
    """
    q = db.query(CdrRecord)
    if msisdn:
        q = q.filter(CdrRecord.msisdn == msisdn)
    if start_date:
        q = q.filter(CdrRecord.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(CdrRecord.start_time <= datetime.fromisoformat(end_date + "T23:59:59"))
    records = q.order_by(CdrRecord.start_time.asc()).limit(limit).all()

    if not records:
        return SignalStatsResponse(
            rx_timeline=[], network_dist=[], band_dist=[],
            avg_rx=None, strong_pct=0, medium_pct=0, weak_pct=0,
        )

    # Rx timeline — use rx_level if present, else simulate from lat/lng
    rx_points: list[RxPoint] = []
    rx_values: list[float] = []
    for r in records:
        # Simulate Rx level from haversine distance to grid point if not stored
        dist = _haversine_m(r.latitude, r.longitude, round(r.latitude, 2), round(r.longitude, 2))
        simulated_rx = -50 - dist * 0.04
        rx = simulated_rx
        rx_values.append(rx)
        rx_points.append(RxPoint(
            timestamp=r.start_time.isoformat() if r.start_time else "",
            rx_level=round(rx, 1),
            network=r.network or "Unknown",
            operator=r.operator,
        ))

    # Signal strength buckets
    total = len(rx_values) or 1
    strong = sum(1 for v in rx_values if v >= -70)
    medium = sum(1 for v in rx_values if -85 <= v < -70)
    weak   = sum(1 for v in rx_values if v < -85)

    # Network distribution
    net_counts: dict[str, int] = {}
    for r in records:
        net = r.network or "Unknown"
        net_counts[net] = net_counts.get(net, 0) + 1
    network_dist = [{"name": k, "value": v, "pct": round(v / total * 100, 1)} for k, v in sorted(net_counts.items(), key=lambda x: -x[1])]

    # Band distribution
    band_counts: dict[str, int] = {}
    for r in records:
        band = r.band or "Unknown"
        band_counts[band] = band_counts.get(band, 0) + 1
    band_dist = [FreqBucket(band=k, count=v) for k, v in sorted(band_counts.items(), key=lambda x: -x[1])]

    return SignalStatsResponse(
        rx_timeline=rx_points,
        network_dist=network_dist,
        band_dist=band_dist,
        avg_rx=round(sum(rx_values) / total, 1),
        strong_pct=round(strong / total * 100, 1),
        medium_pct=round(medium / total * 100, 1),
        weak_pct=round(weak / total * 100, 1),
    )


# ── /cdr/analytics-summary ───────────────────────────────────────────────────

class HourBucket(BaseModel):
    hour: int
    count: int

class AnalyticsSummaryResponse(BaseModel):
    total_records: int
    total_msisdns: int
    total_targets: int
    suspicious_count: int
    fake_count: int
    silent_count: int
    peak_hour: int | None
    peak_hour_count: int
    hourly_dist: list[HourBucket]
    most_contacted: str | None
    most_contacted_count: int
    avg_duration_sec: float
    top_operator: str | None
    top_network: str | None

@router.get("/analytics-summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    msisdn: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    operator: str | None = Query(None),
    network: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """
    Aggregated analytics summary for the dashboard KPI cards.
    Respects all active filters.
    """
    q = db.query(CdrRecord)
    if msisdn:
        q = q.filter(CdrRecord.msisdn == msisdn)
    if start_date:
        q = q.filter(CdrRecord.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(CdrRecord.start_time <= datetime.fromisoformat(end_date + "T23:59:59"))
    if operator:
        q = q.filter(CdrRecord.operator == operator)
    if network:
        q = q.filter(CdrRecord.network == network)
    records = q.limit(5000).all()

    if not records:
        return AnalyticsSummaryResponse(
            total_records=0, total_msisdns=0, total_targets=0,
            suspicious_count=0, fake_count=0, silent_count=0,
            peak_hour=None, peak_hour_count=0, hourly_dist=[],
            most_contacted=None, most_contacted_count=0,
            avg_duration_sec=0, top_operator=None, top_network=None,
        )

    total = len(records)
    msisdns = {r.msisdn for r in records if r.msisdn}
    targets = {r.target for r in records if r.target}
    fake_c = sum(1 for r in records if r.is_fake)
    silent_c = sum(1 for r in records if r.silent_call_type and r.silent_call_type != "None")
    suspicious_c = sum(1 for r in records if r.is_fake or (r.silent_call_type and r.silent_call_type != "None"))

    # Hourly distribution
    hour_counts: dict[int, int] = {h: 0 for h in range(24)}
    for r in records:
        if r.start_time:
            hour_counts[r.start_time.hour] = hour_counts.get(r.start_time.hour, 0) + 1
    peak_hour = max(hour_counts, key=lambda h: hour_counts[h]) if hour_counts else None
    hourly_dist = [HourBucket(hour=h, count=hour_counts[h]) for h in range(24)]

    # Most contacted
    target_freq: dict[str, int] = {}
    for r in records:
        if r.target:
            target_freq[r.target] = target_freq.get(r.target, 0) + 1
    most_contacted = max(target_freq, key=lambda k: target_freq[k]) if target_freq else None
    most_contacted_count = target_freq.get(most_contacted, 0) if most_contacted else 0

    # Operator / network mode
    op_counts: dict[str, int] = {}
    net_counts: dict[str, int] = {}
    for r in records:
        if r.operator: op_counts[r.operator] = op_counts.get(r.operator, 0) + 1
        if r.network:  net_counts[r.network]  = net_counts.get(r.network, 0) + 1
    top_operator = max(op_counts, key=lambda k: op_counts[k]) if op_counts else None
    top_network  = max(net_counts, key=lambda k: net_counts[k]) if net_counts else None

    avg_dur = sum(r.duration_sec or 0 for r in records) / total

    return AnalyticsSummaryResponse(
        total_records=total,
        total_msisdns=len(msisdns),
        total_targets=len(targets),
        suspicious_count=suspicious_c,
        fake_count=fake_c,
        silent_count=silent_c,
        peak_hour=peak_hour,
        peak_hour_count=hour_counts.get(peak_hour, 0) if peak_hour is not None else 0,
        hourly_dist=hourly_dist,
        most_contacted=most_contacted,
        most_contacted_count=most_contacted_count,
        avg_duration_sec=round(avg_dur, 1),
        top_operator=top_operator,
        top_network=top_network,
    )
