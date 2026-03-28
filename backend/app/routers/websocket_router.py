from fastapi import APIRouter, WebSocket
from jose import JWTError, jwt

from app.config import settings
from app.core.websocket_manager import manager


router = APIRouter()


@router.websocket("/ws/rf-data")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        await websocket.close(code=1008)
        return

    if not payload.get("sub"):
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)