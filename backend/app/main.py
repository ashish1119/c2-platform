from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
<<<<<<< HEAD
=======
from sqlalchemy import text
import asyncio

from app.database import engine, Base, AsyncSessionLocal
import app.models
>>>>>>> origin/Akash
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
<<<<<<< HEAD
from app.core.app_lifecycle import initialize_runtime_services, shutdown_runtime_services
from app.core.db_bootstrap import bootstrap_database
from app.logging_config import logger
from app.database import engine
from app.services.tcp_server import start_tcp_server

import threading
=======
from app.core.websocket_manager import manager
from app.logging_config import logger
from app.database import engine, Base, AsyncSessionLocal
from app.services.decodio_config_service import ensure_decodio_config
from app.services.jammer_service import ensure_default_jammer
from app.services.tcp_server import start_tcp_server
from app.routers.websocket_router import router as websocket_router

import threading

# Start TCP server in background thread

>>>>>>> origin/Akash

app = FastAPI(title="C2 Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def start_tcp():
    threading.Thread(target=start_tcp_server, daemon=True).start()

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
async def create_tables():
    async with engine.begin() as conn:
        await bootstrap_database(conn)
    await initialize_runtime_services(app)

    threading.Thread(target=start_tcp_server, daemon=True).start()

@app.on_event("startup")
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


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

<<<<<<< HEAD



from jose import jwt, JWTError

SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

@app.websocket("/ws/rf-data")
async def websocket_rf_data(websocket: WebSocket):
    token = websocket.query_params.get("token")

    if not token:
        print("❌ No token")
        await websocket.close(code=403)
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            print("❌ Invalid token")
            await websocket.close(code=403)
            return

        print("✅ WS Authenticated:", user_id)

    except JWTError as e:
        print("❌ JWT Error:", e)
        await websocket.close(code=403)
        return

    # ✅ CONNECT
    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()
    except:
        manager.disconnect(websocket)
=======
import asyncio
from app.core.websocket_manager import manager

@app.on_event("startup")
async def startup_event():
    manager.loop = asyncio.get_event_loop()
>>>>>>> origin/Akash
