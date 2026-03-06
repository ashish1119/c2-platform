from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.routers import (
    auth_router,
    alerts_router,
    users_router,
    roles_router,
    permissions_router,
    assets_router,
    rf_router,
    reports_router,
    decodio_router,
    audit_router,
    jammer_router,
    jammer_control_router,
    direction_finder_router,
    sms_router,
    tcp_listener_router,
    geospatial_router,
    crfs_router,
)
from app.integrations.decodio.service import DecodioIntegrationService
from app.integrations.crfs.service import CrfsIngestService
from app.integrations.tcp_listener.service import TcpListenerService
from app.core.websocket_manager import manager
from app.logging_config import logger
from app.database import engine, Base, AsyncSessionLocal
from app.services.decodio_config_service import ensure_decodio_config
from app.services.jammer_service import ensure_default_jammer

app = FastAPI(title="C2 Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(alerts_router.router)
app.include_router(users_router.router)
app.include_router(roles_router.router)
app.include_router(permissions_router.router)
app.include_router(assets_router.router)
app.include_router(rf_router.router)
app.include_router(reports_router.router)
app.include_router(decodio_router.router)
app.include_router(audit_router.router)
app.include_router(jammer_router.router)
app.include_router(jammer_control_router.router)
app.include_router(direction_finder_router.router)
app.include_router(sms_router.router)
app.include_router(tcp_listener_router.router)
app.include_router(geospatial_router.router)
app.include_router(crfs_router.router)


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


@app.on_event("startup")
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1"))
        await conn.execute(text("UPDATE roles SET level = 10 WHERE name = 'ADMIN' AND (level IS NULL OR level = 1)"))
        await conn.execute(text("UPDATE roles SET level = 5 WHERE name = 'OPERATOR' AND (level IS NULL OR level = 1)"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('decodio', 'read', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('decodio', 'write', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('audit', 'read', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('jammer', 'read', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('jammer', 'write', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('direction_finder', 'read', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('direction_finder', 'write', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('sms', 'read', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('sms', 'write', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('sms_threat', 'read', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('sms_threat', 'write', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('geospatial', 'read', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('geospatial', 'write', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('crfs', 'read', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('crfs', 'write', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("INSERT INTO permissions (resource, action, scope) VALUES ('crfs', 'replay', 'GLOBAL') ON CONFLICT (resource, action) DO NOTHING"))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'decodio' AND p.action = 'read'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'decodio' AND p.action = 'write'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'audit' AND p.action = 'read'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'jammer' AND p.action = 'read'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'jammer' AND p.action = 'write'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'direction_finder' AND p.action = 'read'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'direction_finder' AND p.action = 'write'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'sms' AND p.action = 'read'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'sms' AND p.action = 'write'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'sms_threat' AND p.action = 'read'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'sms_threat' AND p.action = 'write'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'geospatial' AND p.action = 'read'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'geospatial' AND p.action = 'write'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'crfs' AND p.action = 'read'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'crfs' AND p.action = 'write'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'crfs' AND p.action = 'replay'
            WHERE r.name = 'ADMIN'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.resource = 'crfs' AND p.action = 'read'
            WHERE r.name = 'OPERATOR'
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """))
        await conn.execute(text("ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS modulation VARCHAR(50) DEFAULT 'UNKNOWN'"))
        await conn.execute(text("ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS bandwidth_hz DOUBLE PRECISION"))
        await conn.execute(text("ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION DEFAULT 0.5"))
        await conn.execute(text("ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS doa_deg DOUBLE PRECISION"))
        await conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS height_m DOUBLE PRECISION"))
        await conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS range_m DOUBLE PRECISION"))
        await conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS bearing_deg DOUBLE PRECISION"))
        await conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS fov_deg DOUBLE PRECISION"))
        await conn.execute(text("ALTER TABLE jammer_profiles ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64)"))
        await conn.execute(text("ALTER TABLE jammer_profiles ADD COLUMN IF NOT EXISTS port INTEGER"))
        await conn.execute(text("UPDATE jammer_profiles SET ip_address = '127.0.0.1' WHERE ip_address IS NULL OR trim(ip_address) = ''"))
        await conn.execute(text("UPDATE jammer_profiles SET port = 5001 WHERE port IS NULL"))
        await conn.execute(text("ALTER TABLE jammer_profiles ALTER COLUMN ip_address SET NOT NULL"))
        await conn.execute(text("ALTER TABLE jammer_profiles ALTER COLUMN port SET NOT NULL"))
        await conn.execute(text("""
            UPDATE assets
            SET type = CASE
                WHEN replace(upper(regexp_replace(trim(type), '[\\s-]+', '_', 'g')), '_', '') IN ('DF', 'DIRECTIONFINDER') THEN 'DIRECTION_FINDER'
                WHEN replace(upper(regexp_replace(trim(type), '[\\s-]+', '_', 'g')), '_', '') IN ('C2', 'C2NODE') THEN 'C2_NODE'
                WHEN replace(upper(regexp_replace(trim(type), '[\\s-]+', '_', 'g')), '_', '') = 'JAMMER' THEN 'JAMMER'
                ELSE upper(regexp_replace(trim(type), '[\\s-]+', '_', 'g'))
            END
            WHERE type IS NOT NULL AND trim(type) <> ''
        """))
        await conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_name VARCHAR(255)"))
        await conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(100)"))
        await conn.execute(text("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb"))
        await conn.execute(text("UPDATE audit_logs SET details = '{}'::jsonb WHERE details IS NULL"))
        await conn.execute(text("ALTER TABLE geospatial_ingestion_sources ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"))
        await conn.execute(text("UPDATE geospatial_ingestion_sources SET is_active = TRUE WHERE is_active IS NULL"))
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


@app.on_event("shutdown")
async def shutdown_services():
    decodio_service = getattr(app.state, "decodio_service", None)
    if decodio_service is not None:
        await decodio_service.stop()

    tcp_listener_service = getattr(app.state, "tcp_listener_service", None)
    if tcp_listener_service is not None:
        await tcp_listener_service.stop()

    crfs_ingest_service = getattr(app.state, "crfs_ingest_service", None)
    if crfs_ingest_service is not None:
        await crfs_ingest_service.stop()


@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        manager.disconnect(websocket)