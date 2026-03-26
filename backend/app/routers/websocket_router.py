from fastapi import APIRouter, WebSocket
from app.core.websocket_manager import manager

router = APIRouter()


@router.websocket("/ws/rf-data")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()  # keep alive

    except:
        manager.disconnect(websocket)