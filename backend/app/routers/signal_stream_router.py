from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core.security import decode_access_token
from app.core.signal_stream_hub import signal_stream_hub

router = APIRouter()


def _extract_websocket_token(websocket: WebSocket) -> str | None:
    query_token = websocket.query_params.get("token")
    if query_token:
        return query_token
    return websocket.cookies.get("access_token")


@router.websocket("/ws/signal-analyzer")
async def signal_analyzer_ws(websocket: WebSocket):
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

    await signal_stream_hub.connect(websocket)
    try:
        while True:
            # Keep alive; client can send pings.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await signal_stream_hub.disconnect(websocket)
    except Exception:
        await signal_stream_hub.disconnect(websocket)

