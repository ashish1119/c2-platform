from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.sms.codec import normalize_detection, utc_now
from app.integrations.sms.state_cache import SmsAdapterStateCache
from app.integrations.sms.transport import SmsAdapterTransport
from app.models import SmsDetection, SmsNodeHealth
from app.schemas import SmsAdapterIngestRequest, SmsAdapterIngestResponse


sms_adapter_cache = SmsAdapterStateCache()
sms_adapter_transport = SmsAdapterTransport()


def get_sms_adapter_health_snapshot() -> dict:
    return sms_adapter_cache.snapshot(
        running=sms_adapter_transport.is_running(),
        queue_depth=sms_adapter_transport.queue_depth(),
    )


async def ingest_sms_adapter_batch(request: SmsAdapterIngestRequest, db: AsyncSession) -> SmsAdapterIngestResponse:
    row = await db.execute(select(SmsNodeHealth).where(SmsNodeHealth.source_node == request.source_node))
    node = row.scalar_one_or_none()

    if node is None:
        node = SmsNodeHealth(
            source_node=request.source_node,
            online=True,
            last_heartbeat=utc_now(),
            metrics=request.metrics or {},
        )
        db.add(node)
    else:
        node.online = True
        node.last_heartbeat = utc_now()
        if request.metrics:
            merged = dict(node.metrics or {})
            merged.update(request.metrics)
            node.metrics = merged

    sms_adapter_cache.mark_node_heartbeat(
        source_node=request.source_node,
        timestamp=node.last_heartbeat,
        metrics=request.metrics,
    )
    sms_adapter_cache.mark_message_time(node.last_heartbeat)
    sms_adapter_cache.increment_processed()
    sms_adapter_cache.set_error(None)

    accepted = 0
    rejected = 0
    errors: list[str] = []

    for idx, raw in enumerate(request.detections):
        try:
            normalized = normalize_detection(raw, request.source_node)
            db.add(SmsDetection(**normalized.model_dump()))
            accepted += 1
            sms_adapter_cache.increment_accepted()
        except Exception as exc:
            rejected += 1
            sms_adapter_cache.increment_rejected()
            sms_adapter_cache.set_error(str(exc))
            errors.append(f"item[{idx}]: {exc}")

    await db.commit()
    await db.refresh(node)

    return SmsAdapterIngestResponse(
        accepted=accepted,
        rejected=rejected,
        errors=errors,
        node_health=node,
    )
