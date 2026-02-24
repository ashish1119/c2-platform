from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.services.alert_service import acknowledge_alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.post("/{alert_id}/ack")
async def ack_alert(alert_id: str, user_id: str, db: AsyncSession = Depends(get_db)):
    return await acknowledge_alert(db, alert_id, user_id)