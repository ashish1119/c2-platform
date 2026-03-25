from collections import deque
from datetime import datetime

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder


class SmsRealtimeHub:
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._recent_events: deque[dict] = deque(maxlen=500)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def publish(self, event: dict) -> None:
        event_payload = jsonable_encoder(event)
        if "published_at" not in event_payload:
            event_payload["published_at"] = datetime.utcnow().isoformat()

        self._recent_events.append(event_payload)

        if not self._connections:
            return

        failed: list[WebSocket] = []
        for connection in self._connections:
            try:
                await connection.send_json(event_payload)
            except Exception:
                failed.append(connection)

        for connection in failed:
            self._connections.discard(connection)

    def recent_events(self, limit: int = 100) -> list[dict]:
        bounded = max(1, min(limit, 500))
        return [jsonable_encoder(item) for item in list(self._recent_events)[-bounded:]]

    def health(self) -> dict:
        return {
            "active_ws_connections": len(self._connections),
            "recent_event_count": len(self._recent_events),
        }


sms_realtime_hub = SmsRealtimeHub()
