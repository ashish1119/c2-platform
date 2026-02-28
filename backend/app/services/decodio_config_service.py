from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import DecodioApiConfig
from app.schemas import DecodioConfigRead, DecodioConfigUpdate


DEFAULT_EVENT_ALIASES = {
    "callInfo": ["callInfo", "call_info", "CALL_INFO"],
    "dataInfo": ["dataInfo", "data_info", "DATA_INFO"],
    "triggerUpdate": ["triggerUpdate", "trigger_update", "TRIGGER_UPDATE", "alert"],
    "slotInfo": ["slotInfo", "slot_info", "SLOT_INFO"],
    "laInfo": ["laInfo", "la_info", "LA_INFO"],
    "LiveChanged": ["LiveChanged", "liveChanged", "LIVE_CHANGED"],
}


def _to_read(config: DecodioApiConfig) -> DecodioConfigRead:
    return DecodioConfigRead(
        enabled=config.enabled,
        host=config.host,
        port=config.port,
        connect_timeout_seconds=config.connect_timeout_seconds,
        read_timeout_seconds=config.read_timeout_seconds,
        heartbeat_interval_seconds=config.heartbeat_interval_seconds,
        ack_timeout_seconds=config.ack_timeout_seconds,
        reconnect_max_seconds=config.reconnect_max_seconds,
        json_format=config.json_format,
        event_aliases=config.event_aliases or DEFAULT_EVENT_ALIASES,
        updated_at=config.updated_at,
    )


async def ensure_decodio_config(db: AsyncSession) -> DecodioApiConfig:
    result = await db.execute(select(DecodioApiConfig).limit(1))
    config = result.scalar_one_or_none()
    if config is not None:
        if not config.event_aliases:
            config.event_aliases = DEFAULT_EVENT_ALIASES
            await db.commit()
            await db.refresh(config)
        return config

    config = DecodioApiConfig(
        id=1,
        enabled=settings.DECODIO_ENABLED,
        host=settings.DECODIO_HOST,
        port=settings.DECODIO_PORT,
        connect_timeout_seconds=settings.DECODIO_CONNECT_TIMEOUT_SECONDS,
        read_timeout_seconds=settings.DECODIO_READ_TIMEOUT_SECONDS,
        heartbeat_interval_seconds=settings.DECODIO_HEARTBEAT_INTERVAL_SECONDS,
        ack_timeout_seconds=settings.DECODIO_ACK_TIMEOUT_SECONDS,
        reconnect_max_seconds=settings.DECODIO_RECONNECT_MAX_SECONDS,
        json_format="auto",
        event_aliases=DEFAULT_EVENT_ALIASES,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


async def get_decodio_config(db: AsyncSession) -> DecodioConfigRead:
    config = await ensure_decodio_config(db)
    return _to_read(config)


async def update_decodio_config(db: AsyncSession, payload: DecodioConfigUpdate) -> DecodioConfigRead:
    config = await ensure_decodio_config(db)

    config.enabled = payload.enabled
    config.host = payload.host
    config.port = payload.port
    config.connect_timeout_seconds = payload.connect_timeout_seconds
    config.read_timeout_seconds = payload.read_timeout_seconds
    config.heartbeat_interval_seconds = payload.heartbeat_interval_seconds
    config.ack_timeout_seconds = payload.ack_timeout_seconds
    config.reconnect_max_seconds = payload.reconnect_max_seconds
    config.json_format = payload.json_format
    config.event_aliases = payload.event_aliases or DEFAULT_EVENT_ALIASES

    await db.commit()
    await db.refresh(config)
    return _to_read(config)
