import asyncio
import logging
from collections import defaultdict
from typing import DefaultDict, List

from fastapi import WebSocket


logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._websocket_jti: dict[WebSocket, str] = {}
        self._jti_connections: DefaultDict[str, set[WebSocket]] = defaultdict(set)
        try:
            self.loop = asyncio.get_event_loop()
        except RuntimeError:
            self.loop = None

    async def connect(self, websocket: WebSocket, jti: str | None = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if jti:
            self._websocket_jti[websocket] = jti
            self._jti_connections[jti].add(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        jti = self._websocket_jti.pop(websocket, None)
        if jti:
            jti_connections = self._jti_connections.get(jti)
            if jti_connections is not None:
                jti_connections.discard(websocket)
                if not jti_connections:
                    self._jti_connections.pop(jti, None)

    async def disconnect_by_jti(self, jti: str) -> None:
        websockets = list(self._jti_connections.get(jti, set()))
        for websocket in websockets:
            try:
                await websocket.close(code=1008)
            except Exception as exc:
                logger.debug("WebSocket close during token revocation failed: %s", exc)
            finally:
                self.disconnect(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as exc:
                logger.warning("WebSocket broadcast failed; disconnecting client: %s", exc)
                self.disconnect(connection)

    def send_from_thread(self, message: dict):
        if self.loop is None:
            return

        asyncio.run_coroutine_threadsafe(self.broadcast(message), self.loop)


manager = ConnectionManager()
