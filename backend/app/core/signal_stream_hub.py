import asyncio
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class SignalStreamHub:
    """
    Dedicated websocket hub for high-rate signal streaming.
    Kept separate from the global websocket manager to avoid broadcasting
    signal packets to unrelated websocket endpoints (alerts, rf-data, etc).
    """

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        try:
            self.loop = asyncio.get_event_loop()
        except RuntimeError:
            self.loop = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)
        try:
            await websocket.close(code=1000)
        except Exception:
            pass

    async def broadcast(self, message: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.debug("Signal stream ws send failed: %s", exc)
                dead.append(ws)
        for ws in dead:
            self._connections.discard(ws)

    def send_from_thread(self, message: dict[str, Any]) -> None:
        if self.loop is None:
            return
        asyncio.run_coroutine_threadsafe(self.broadcast(message), self.loop)


signal_stream_hub = SignalStreamHub()

