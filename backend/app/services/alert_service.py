from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException
from datetime import datetime
import random
from geoalchemy2 import Geometry
from geoalchemy2.elements import WKTElement
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


async def simulate_alerts_batch(db: AsyncSession, count: int = 50):
    bounded_count = max(1, min(count, 200))

    templates = [
        {
            "alert_type": "RADAR",
            "alert_name": "RADAR alert",
            "sender": "radar-blr-01",
            "source_name": "Radar BLR 01",
            "source_type": "RADAR",
            "source_details": "band=X,mode=TRACK",
            "description": "target_signature=fast_moving",
            "severity": ["LOW", "MEDIUM", "HIGH"],
        },
        {
            "alert_type": "DIRECTION_FINDER",
            "alert_name": "Direction Finder Alert",
            "sender": "df-node-blr-01",
            "source_name": "DF Node BLR 01",
            "source_type": "DIRECTION_FINDER",
            "source_details": "array=ULA,doa_quality=good",
            "description": "bearing_track=active",
            "severity": ["MEDIUM", "HIGH", "CRITICAL"],
        },
        {
            "alert_type": "JAMMER",
            "alert_name": "JAMMER alert",
            "sender": "jammer-blr-01",
            "source_name": "Jammer BLR 01",
            "source_type": "JAMMER",
            "source_details": "mode=barrage,power=high",
            "description": "rf_interference_detected=true",
            "severity": ["MEDIUM", "HIGH"],
        },
        {
            "alert_type": "TEMPERATURE",
            "alert_name": "TEMPERATURE alert",
            "sender": "thermal-blr-01",
            "source_name": "Thermal BLR 01",
            "source_type": "SENSOR",
            "source_details": "sensor=thermal,module=T-9",
            "description": "threshold_crossed=true",
            "severity": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        },
    ]

    alerts: list[Alert] = []
    for index in range(bounded_count):
        template = templates[index % len(templates)]
        latitude = round(random.uniform(12.95, 12.99), 6)
        longitude = round(random.uniform(77.57, 77.61), 6)
        severity = random.choice(template["severity"])

        description = (
            f"TCP event={template['alert_type'].lower()} sender={template['sender']} "
            f"source_name={template['source_name']} | source_type={template['source_type']} | "
            f"source_details={template['source_details']} | {template['description']} | sample={index + 1}"
        )

        alerts.append(
            Alert(
                alert_name=template["alert_name"],
                alert_type=template["alert_type"],
                severity=severity,
                status="NEW",
                description=description,
                location=WKTElement(f"POINT({longitude} {latitude})", srid=4326),
            )
        )

    db.add_all(alerts)
    await db.commit()

    await manager.broadcast(
        {"event": "alerts_simulated", "count": bounded_count}
    )

    return {"created": bounded_count, "event": "alerts_simulated"}