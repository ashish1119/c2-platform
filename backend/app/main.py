import asyncio
import threading

from fastapi import FastAPI, HTTPException ,WebSocket
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.extension import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

import app.models
from app.config import settings
from app.core.app_lifecycle import initialize_runtime_services, shutdown_runtime_services
from app.core.db_bootstrap import bootstrap_database
from app.core.rate_limiter import limiter
from app.core.websocket_manager import manager
from app.database import engine
from app.routers import (
    alerts_router,
    assets_router,
    audit_router,
    auth_router,
    cdr_router,
    crfs_router,
    decodio_router,
    direction_finder_router,
    geospatial_router,
    jammer_control_router,
    jammer_router,
    permissions_router,
    reports_router,
    rf_router,
    roles_router,
    signal_router,
    sms_router,
    telecom_router,
    tcp_listener_router,
    users_router,
)
from app.routers.websocket_router import router as websocket_router
from app.services.tcp_server import  start_tcp_server

from app.services import tcp_server


app = FastAPI(title="C2 Platform")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
app.include_router(telecom_router.router)
app.include_router(tcp_listener_router.router)
app.include_router(geospatial_router.router)
app.include_router(crfs_router.router)
app.include_router(websocket_router)
app.include_router(cdr_router.router)
app.include_router(signal_router.router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> dict[str, object]:
    checks: dict[str, str] = {}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database not ready: {exc}")

    tcp_listener_service = getattr(app.state, "tcp_listener_service", None)
    if tcp_listener_service is not None and tcp_listener_service.enabled:
        running = bool(tcp_listener_service.get_health_snapshot().get("running"))
        checks["tcp_listener"] = "ok" if running else "not_running"
        if not running:
            raise HTTPException(status_code=503, detail="TCP listener service not running")

    crfs_ingest_service = getattr(app.state, "crfs_ingest_service", None)
    if crfs_ingest_service is not None and crfs_ingest_service.enabled:
        running = bool(crfs_ingest_service.health_snapshot().get("running"))
        checks["crfs_ingest"] = "ok" if running else "not_running"
        if not running:
            raise HTTPException(status_code=503, detail="CRFS ingest service not running")

    return {"status": "ready", "checks": checks}


@app.on_event("startup")
async def startup_services() -> None:
    manager.loop = asyncio.get_running_loop()

    async with engine.begin() as conn:
        await bootstrap_database(conn)

    await initialize_runtime_services(app)
    threading.Thread(target=start_tcp_server, daemon=True).start()

# @app.on_event("startup")
# async def startup_services() -> None:
#     manager.loop = asyncio.get_running_loop()

#     async with engine.begin() as conn:
#         await bootstrap_database(conn)

#     await initialize_runtime_services(app)

#     # 🔥 START DB WORKER (MANDATORY)
#     asyncio.create_task(db_worker())

#     # 🔥 START TCP SERVER
#     threading.Thread(target=start_tcp_server, daemon=True).start()


@app.on_event("shutdown")
async def shutdown_services() -> None:
    await shutdown_runtime_services(app)



# ===============================
# WEBSOCKET: ALERTS (existing)
# ===============================
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        manager.disconnect(websocket)


# ===============================
# 🔥 NEW WEBSOCKET: RF STREAM
# ===============================
@app.websocket("/ws/rf")
async def websocket_rf(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        manager.disconnect(websocket)