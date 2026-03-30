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
import asyncio
from typing import List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.loop = None  # 🔥 store main event loop

    # ===============================
    # CONNECT
    # ===============================
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

        # 🔥 capture event loop (important for thread-safe send)
        if self.loop is None:
            self.loop = asyncio.get_running_loop()

        print(f"🟢 Connected: {len(self.active_connections)} clients")

    # ===============================
    # DISCONNECT
    # ===============================
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        print(f"🔴 Disconnected: {len(self.active_connections)} clients")

    # ===============================
    # ASYNC BROADCAST
    # ===============================
    async def broadcast(self, message: dict):
        dead_connections = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)

        # 🔥 cleanup broken connections
        for conn in dead_connections:
            self.disconnect(conn)

    # ===============================
    # THREAD SAFE SEND (VERY IMPORTANT)
    # ===============================
    def send_from_thread(self, message: dict):
        if not self.loop:
            print("⚠️ No event loop available yet")
            return

        asyncio.run_coroutine_threadsafe(
            self.broadcast(message),
            self.loop
        )


# 🔥 GLOBAL INSTANCE
manager = ConnectionManager()