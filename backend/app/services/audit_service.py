from app.models import AuditLog
from app.models import User
from sqlalchemy import select
from datetime import datetime


async def write_audit_log(db, user_id, action, entity, entity_id=None, details=None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=details or {},
    )
    db.add(log)
    await db.commit()
    return log


async def list_audit_logs(
    db,
    action: str | None = None,
    username: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    limit: int = 200,
):
    query = (
        select(
            AuditLog.id,
            AuditLog.user_id,
            AuditLog.action,
            AuditLog.entity,
            AuditLog.details,
            AuditLog.timestamp,
            User.username.label("username"),
        )
        .select_from(AuditLog)
        .join(User, AuditLog.user_id == User.id, isouter=True)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
    )
    if action:
        query = query.where(AuditLog.action == action)
    if username:
        query = query.where(User.username.ilike(f"%{username}%"))
    if start_time:
        query = query.where(AuditLog.timestamp >= start_time)
    if end_time:
        query = query.where(AuditLog.timestamp <= end_time)
    result = await db.execute(query)
    return [dict(row._mapping) for row in result.all()]
