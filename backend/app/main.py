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
)
from app.core.websocket_manager import manager
from app.logging_config import logger
from app.database import engine, Base

app = FastAPI(title="C2 Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
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


@app.on_event("startup")
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1"))
        await conn.execute(text("UPDATE roles SET level = 10 WHERE name = 'ADMIN' AND (level IS NULL OR level = 1)"))
        await conn.execute(text("UPDATE roles SET level = 5 WHERE name = 'OPERATOR' AND (level IS NULL OR level = 1)"))
        await conn.execute(text("ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS modulation VARCHAR(50) DEFAULT 'UNKNOWN'"))
        await conn.execute(text("ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS bandwidth_hz DOUBLE PRECISION"))
        await conn.execute(text("ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION DEFAULT 0.5"))
        await conn.execute(text("ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS doa_deg DOUBLE PRECISION"))


@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        manager.disconnect(websocket)