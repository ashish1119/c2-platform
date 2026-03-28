import asyncio
import threading

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

import app.models
from app.config import settings
from app.core.app_lifecycle import initialize_runtime_services, shutdown_runtime_services
from app.core.db_bootstrap import bootstrap_database
from app.core.websocket_manager import manager
from app.database import engine
from app.routers import (
    alerts_router,
    assets_router,
    audit_router,
    auth_router,
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
    sms_router,
    tcp_listener_router,
    users_router,
)
from app.routers.websocket_router import router as websocket_router
from app.services.tcp_server import start_tcp_server


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
app.include_router(websocket_router)


@app.on_event("startup")
async def startup_services() -> None:
    manager.loop = asyncio.get_running_loop()

    async with engine.begin() as conn:
        await bootstrap_database(conn)

    await initialize_runtime_services(app)
    threading.Thread(target=start_tcp_server, daemon=True).start()


@app.on_event("shutdown")
async def shutdown_services() -> None:
    await shutdown_runtime_services(app)


@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)
