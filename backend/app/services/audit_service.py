from app.models import AuditLog


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
