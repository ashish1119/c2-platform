from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException
from datetime import datetime
from geoalchemy2 import Geometry
from app.models import Alert, User
from app.core.websocket_manager import manager


VALID_TRANSITIONS = {
    "NEW": ["ACKNOWLEDGED"],
    "ACKNOWLEDGED": ["RESOLVED"],
    "RESOLVED": []
}


async def list_alerts(db: AsyncSession, status: str | None = None):
    query = select(
        Alert.id,
        Alert.asset_id,
        Alert.alert_name,
        Alert.alert_type,
        Alert.severity,
        Alert.status,
        Alert.description,
        Alert.acknowledged_by,
        User.username.label("acknowledged_by_name"),
        Alert.acknowledged_at,
        Alert.created_at,
        func.ST_Y(Alert.location.cast(Geometry)).label("latitude"),
        func.ST_X(Alert.location.cast(Geometry)).label("longitude"),
    ).outerjoin(User, User.id == Alert.acknowledged_by).order_by(Alert.created_at.desc())
    if status:
        query = query.where(Alert.status == status)
    result = await db.execute(query)
    rows = result.all()
    return [
        {
            "id": row.id,
            "asset_id": row.asset_id,
            "alert_name": row.alert_name,
            "alert_type": row.alert_type,
            "severity": row.severity,
            "status": row.status,
            "description": row.description,
            "acknowledged_by": row.acknowledged_by,
            "acknowledged_by_name": row.acknowledged_by_name,
            "acknowledged_at": row.acknowledged_at,
            "created_at": row.created_at,
            "latitude": row.latitude,
            "longitude": row.longitude,
        }
        for row in rows
    ]


async def acknowledge_alert(
    db: AsyncSession, alert_id, user_id
):
    async with db.begin():
        result = await db.execute(
            select(Alert).where(Alert.id == alert_id).with_for_update()
        )
        alert = result.scalar_one_or_none()

        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        if alert.status != "NEW":
            raise HTTPException(status_code=400, detail="Already processed")

        alert.status = "ACKNOWLEDGED"
        alert.acknowledged_by = user_id
        alert.acknowledged_at = datetime.utcnow()

    await manager.broadcast(
        {"event": "alert_acknowledged", "alert_id": str(alert_id)}
    )

    return {"id": str(alert.id), "status": alert.status, "event": "alert_acknowledged"}


async def clear_alert(db: AsyncSession, alert_id):
    async with db.begin():
        result = await db.execute(
            select(Alert).where(Alert.id == alert_id).with_for_update()
        )
        alert = result.scalar_one_or_none()

        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        if alert.status != "ACKNOWLEDGED":
            raise HTTPException(status_code=400, detail="Only acknowledged alerts can be cleared")

        alert.status = "RESOLVED"

    await manager.broadcast(
        {"event": "alert_cleared", "alert_id": str(alert_id)}
    )

    return {"id": str(alert.id), "status": alert.status, "event": "alert_cleared"}