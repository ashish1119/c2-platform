"""
Signal Intelligence Router
Endpoints:
  GET  /signal/detected   — list detected devices (optionally from DB, falls back to empty)
  GET  /signal/targets    — list intercepted targets
  POST /signal/intercept  — mark a device as intercepted / release intercept
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db_sync
from app.deps import require_permission
from app.models import SignalLog

router = APIRouter(prefix="/signal", tags=["signal"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignalLogRead(BaseModel):
    id: str
    imsi: str
    imei: str | None
    msisdn: str | None
    operator: str | None
    network: str | None
    band: str | None
    latitude: float
    longitude: float
    signal_dbm: float | None
    signal_strength: str
    status: str
    is_intercepted: bool
    is_fake: bool
    detected_at: datetime

    class Config:
        from_attributes = True


class InterceptRequest(BaseModel):
    imsi: str
    intercept: bool = True          # True = start intercept, False = release


class SignalIngestRequest(BaseModel):
    imsi: str
    imei: str | None = None
    msisdn: str | None = None
    operator: str | None = None
    network: str | None = None
    band: str | None = None
    latitude: float
    longitude: float
    signal_dbm: float | None = None
    signal_strength: str = "Medium"
    status: str = "Active"
    is_fake: bool = False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/detected", response_model=list[SignalLogRead])
def get_detected(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db_sync),
    _claims: dict = Depends(require_permission("telecom", "read")),
):
    """Return recently detected devices, newest first."""
    rows = (
        db.query(SignalLog)
        .order_by(SignalLog.detected_at.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.get("/targets", response_model=list[SignalLogRead])
def get_targets(
    db: Session = Depends(get_db_sync),
    _claims: dict = Depends(require_permission("telecom", "read")),
):
    """Return all currently intercepted targets."""
    rows = (
        db.query(SignalLog)
        .filter(SignalLog.is_intercepted == True)
        .order_by(SignalLog.detected_at.desc())
        .all()
    )
    return rows


@router.post("/intercept")
def intercept_device(
    payload: InterceptRequest,
    db: Session = Depends(get_db_sync),
    _claims: dict = Depends(require_permission("telecom", "write")),
):
    """Toggle intercept status for a device identified by IMSI."""
    row = db.query(SignalLog).filter(SignalLog.imsi == payload.imsi).first()
    if not row:
        return {"ok": False, "detail": "Device not found"}
    row.is_intercepted = payload.intercept
    db.commit()
    return {"ok": True, "imsi": payload.imsi, "intercepted": payload.intercept}


@router.post("/ingest", status_code=201)
def ingest_signal(
    payload: SignalIngestRequest,
    db: Session = Depends(get_db_sync),
    _claims: dict = Depends(require_permission("telecom", "write")),
):
    """Ingest a single signal detection event (used by scanner / simulator)."""
    existing = db.query(SignalLog).filter(SignalLog.imsi == payload.imsi).first()
    if existing:
        # Update location + status
        existing.latitude = payload.latitude
        existing.longitude = payload.longitude
        existing.signal_dbm = payload.signal_dbm
        existing.signal_strength = payload.signal_strength
        existing.status = payload.status
        existing.updated_at = datetime.now(timezone.utc)
    else:
        row = SignalLog(
            id=uuid.uuid4(),
            imsi=payload.imsi,
            imei=payload.imei,
            msisdn=payload.msisdn,
            operator=payload.operator,
            network=payload.network,
            band=payload.band,
            latitude=payload.latitude,
            longitude=payload.longitude,
            signal_dbm=payload.signal_dbm,
            signal_strength=payload.signal_strength,
            status=payload.status,
            is_fake=payload.is_fake,
        )
        db.add(row)
    db.commit()
    return {"ok": True}
