from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from datetime import datetime
from app.models import Alert
from app.core.websocket_manager import manager


VALID_TRANSITIONS = {
    "NEW": ["ACKNOWLEDGED"],
    "ACKNOWLEDGED": ["RESOLVED"],
    "RESOLVED": []
}


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

    return alert