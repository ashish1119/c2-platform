import asyncio
from typing import List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        try:
            self.loop = asyncio.get_event_loop()
        except RuntimeError:
            self.loop = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

    def send_from_thread(self, message: dict):
        if self.loop is None:
            return

        asyncio.run_coroutine_threadsafe(self.broadcast(message), self.loop)


manager = ConnectionManager()