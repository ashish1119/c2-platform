from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.database import get_db
from app.deps import require_permission
from app.schemas import AuditLogRead
from app.services.audit_service import list_audit_logs

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=list[AuditLogRead])
async def get_audit_logs(
    action: str | None = Query(default=None),
    username: str | None = Query(default=None),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    _: dict = Depends(require_permission("audit", "read")),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_audit_logs(
        db,
        action=action,
        username=username,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )
    return [AuditLogRead(**row) for row in rows]
