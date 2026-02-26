from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.services.alert_service import acknowledge_alert, list_alerts
from app.schemas import AlertAcknowledgeRequest, AlertRead

router = APIRouter(prefix="/alerts", tags=["alerts"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/", response_model=list[AlertRead])
async def get_alerts(status: str | None = Query(default=None), db: AsyncSession = Depends(get_db)):
    return await list_alerts(db, status)


@router.post("/{alert_id}/ack")
async def ack_alert(alert_id: str, payload: AlertAcknowledgeRequest, db: AsyncSession = Depends(get_db)):
    return await acknowledge_alert(db, alert_id, payload.user_id)