from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.services.alert_service import acknowledge_alert, clear_alert, list_alerts, simulate_alerts_batch
from app.schemas import AlertAcknowledgeRequest, AlertRead
from app.deps import get_current_user_claims

router = APIRouter(prefix="/alerts", tags=["alerts"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.get("", response_model=list[AlertRead], include_in_schema=False)
@router.get("/", response_model=list[AlertRead])
async def get_alerts(status: str | None = Query(default=None), db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    return await list_alerts(db, status)


@router.post("/{alert_id}/ack")
async def ack_alert(alert_id: str, payload: AlertAcknowledgeRequest, db: AsyncSession = Depends(get_db)):
    return await acknowledge_alert(db, alert_id, payload.user_id)


@router.post("/{alert_id}/clear")
async def clear_alert_endpoint(alert_id: str, db: AsyncSession = Depends(get_db)):
    return await clear_alert(db, alert_id)


@router.post("/simulate")
async def simulate_alerts(
    count: int = Query(default=50, ge=1, le=200),
    _claims: dict = Depends(get_current_user_claims),
    db: AsyncSession = Depends(get_db),
):
    return await simulate_alerts_batch(db, count)