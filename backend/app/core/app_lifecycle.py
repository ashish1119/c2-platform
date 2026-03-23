from fastapi import FastAPI

from app.config import settings
from app.database import AsyncSessionLocal
from app.integrations.crfs.service import CrfsIngestService
from app.integrations.decodio.service import DecodioIntegrationService
from app.integrations.sms.stream_worker import SmsStreamWorkerService
from app.integrations.tcp_listener.service import TcpListenerService
from app.services.decodio_config_service import ensure_decodio_config
from app.services.jammer_service import ensure_default_jammer


def build_decodio_service(config) -> DecodioIntegrationService:
    return DecodioIntegrationService(
        enabled=config.enabled,
        host=config.host,
        port=config.port,
        connect_timeout=config.connect_timeout_seconds,
        read_timeout=config.read_timeout_seconds,
        heartbeat_interval=config.heartbeat_interval_seconds,
        reconnect_max_seconds=config.reconnect_max_seconds,
        ack_timeout_seconds=config.ack_timeout_seconds,
        json_format=config.json_format,
        event_aliases=config.event_aliases,
    )


async def initialize_runtime_services(app: FastAPI) -> None:
    async with AsyncSessionLocal() as session:
        decodio_config = await ensure_decodio_config(session)
        await ensure_default_jammer(session)

    app.state.decodio_service = build_decodio_service(decodio_config)
    await app.state.decodio_service.start()

    app.state.tcp_listener_service = TcpListenerService(
        enabled=settings.TCP_LISTENER_ENABLED,
        host=settings.TCP_LISTENER_HOST,
        port=settings.TCP_LISTENER_PORT,
        idle_timeout_seconds=settings.TCP_LISTENER_IDLE_TIMEOUT_SECONDS,
        max_line_bytes=settings.TCP_LISTENER_MAX_LINE_BYTES,
    )
    await app.state.tcp_listener_service.start()

    app.state.crfs_ingest_service = CrfsIngestService(
        enabled=settings.CRFS_ENABLED,
        host=settings.CRFS_HOST,
        port=settings.CRFS_PORT,
        idle_timeout_seconds=settings.CRFS_IDLE_TIMEOUT_SECONDS,
        max_message_bytes=settings.CRFS_MAX_MESSAGE_BYTES,
        length_endian=settings.CRFS_LENGTH_ENDIAN,
        signal_power_alert_threshold=settings.CRFS_SIGNAL_POWER_ALERT_THRESHOLD,
        aoa_delta_threshold_deg=settings.CRFS_AOA_DELTA_ALERT_THRESHOLD_DEG,
        redis_url=settings.REDIS_URL,
        redis_stream=settings.CRFS_REDIS_STREAM,
    )
    await app.state.crfs_ingest_service.start()

    app.state.sms_stream_worker_service = SmsStreamWorkerService()
    await app.state.sms_stream_worker_service.start()


async def shutdown_runtime_services(app: FastAPI) -> None:
    await _stop_state_service(app, "decodio_service")
    await _stop_state_service(app, "tcp_listener_service")
    await _stop_state_service(app, "crfs_ingest_service")
    await _stop_state_service(app, "sms_stream_worker_service")


async def _stop_state_service(app: FastAPI, state_key: str) -> None:
    service = getattr(app.state, state_key, None)
    if service is not None:
        await service.stop()
