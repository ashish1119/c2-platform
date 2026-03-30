from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
import logging

from app.core.security import decode_access_token
from app.core.websocket_manager import manager


router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_websocket_token(websocket: WebSocket) -> str | None:
    query_token = websocket.query_params.get("token")
    if query_token:
        return query_token
    return websocket.cookies.get("access_token")


@router.websocket("/ws/rf-data")
async def websocket_endpoint(websocket: WebSocket):
    token = _extract_websocket_token(websocket)
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = decode_access_token(token)
    except JWTError:
        await websocket.close(code=1008)
        return

    if not payload.get("sub"):
        await websocket.close(code=1008)
        return

    jti = payload.get("jti")
    if not jti:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, jti=str(jti))

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("Unexpected websocket error on /ws/rf-data: %s", exc)
        manager.disconnect(websocket)


@router.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    token = _extract_websocket_token(websocket)
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = decode_access_token(token)
    except JWTError:
        await websocket.close(code=1008)
        return

    permissions = set(payload.get("permissions", []))
    role = str(payload.get("role", "")).upper()
    if (
        role != "ADMIN"
        and
        "alerts:read" not in permissions
        and "alerts:*" not in permissions
        and "*:*" not in permissions
    ):
        await websocket.close(code=1008)
        return

    jti = payload.get("jti")
    if not jti:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, jti=str(jti))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("Unexpected websocket error on /ws/alerts: %s", exc)
        manager.disconnect(websocket)