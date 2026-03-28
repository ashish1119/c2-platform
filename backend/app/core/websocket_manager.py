# from fastapi import WebSocket
# from typing import List


# class ConnectionManager:
#     def __init__(self):
#         self.active_connections: List[WebSocket] = []

#     async def connect(self, websocket: WebSocket):
#         await websocket.accept()
#         self.active_connections.append(websocket)

#     def disconnect(self, websocket: WebSocket):
#         self.active_connections.remove(websocket)

#     async def broadcast(self, message: dict):
#         for connection in self.active_connections:
#             await connection.send_json(message)


# manager = ConnectionManager()

<<<<<<< HEAD

=======
>>>>>>> origin/Akash
from fastapi import WebSocket
from typing import List
import asyncio


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

        # 🔥 NEW: event loop reference (safe for threads)
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
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # auto-remove dead connections
                self.disconnect(connection)

    # ✅ NEW METHOD (SAFE ADDITION)
    def send_from_thread(self, message: dict):
        """
        Allows sending data from non-async threads (like TCP server)
        WITHOUT breaking existing async usage.
        """
        if not self.loop:
            try:
                self.loop = asyncio.get_event_loop()
            except RuntimeError:
                return  # no loop available

        asyncio.run_coroutine_threadsafe(
            self.broadcast(message),
            self.loop
        )


manager = ConnectionManager()