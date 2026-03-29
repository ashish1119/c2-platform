from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core.security import decode_access_token


router = APIRouter(prefix="/telecom", tags=["telecom"])


def _extract_websocket_token(websocket: WebSocket) -> str | None:
    query_token = websocket.query_params.get("token")
    if query_token:
        return query_token
    return websocket.cookies.get("access_token")


@router.websocket("/ws/live")
async def telecom_live(websocket: WebSocket):
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

    permissions = set(payload.get("permissions", []))
    role = str(payload.get("role", "")).upper()
    if (
        role != "ADMIN"
        and "telecom:read" not in permissions
        and "telecom:*" not in permissions
        and "*:*" not in permissions
    ):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)
