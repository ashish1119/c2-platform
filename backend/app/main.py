from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
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
from app.core.websocket_manager import manager
from app.core.app_lifecycle import initialize_runtime_services, shutdown_runtime_services
from app.core.db_bootstrap import bootstrap_database
from app.logging_config import logger
from app.database import engine

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

@app.on_event("startup")
async def create_tables():
    async with engine.begin() as conn:
        await bootstrap_database(conn)
    await initialize_runtime_services(app)


@app.on_event("shutdown")
async def shutdown_services():
    await shutdown_runtime_services(app)


@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        manager.disconnect(websocket)