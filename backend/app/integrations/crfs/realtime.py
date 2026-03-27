import asyncio
import importlib
import json
from collections import deque
from datetime import datetime

from fastapi import WebSocket

from app.logging_config import logger


class CrfsRealtimeHub:
    def __init__(self, redis_url: str | None = None, redis_stream: str = "crfs.events"):
        self._connections: set[WebSocket] = set()
        self._recent_events: deque[dict] = deque(maxlen=500)
        self._redis_url = redis_url
        self._redis_stream = redis_stream
        self._redis_client = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def publish(self, event: dict) -> None:
        if "published_at" not in event:
            event["published_at"] = datetime.utcnow().isoformat()

        self._recent_events.append(event)

        if self._connections:
            failed: list[WebSocket] = []
            for conn in self._connections:
                try:
                    await conn.send_json(event)
                except Exception:
                    failed.append(conn)
            for conn in failed:
                self._connections.discard(conn)

        await self._publish_redis(event)

    def recent_events(self, limit: int = 100) -> list[dict]:
        bounded = max(1, min(limit, 500))
        return list(self._recent_events)[-bounded:]

    def health(self) -> dict:
        return {
            "active_ws_connections": len(self._connections),
            "recent_event_count": len(self._recent_events),
            "redis_enabled": bool(self._redis_url),
            "redis_connected": self._redis_client is not None,
            "redis_stream": self._redis_stream,
        }

    async def _publish_redis(self, event: dict) -> None:
        if not self._redis_url:
            return

        client = await self._ensure_redis_client()
        if client is None:
            return

        try:
            payload = {
                "event_type": str(event.get("type", "crfs")),
                "payload": json.dumps(event, default=str),
            }
            await client.xadd(self._redis_stream, payload, maxlen=10000, approximate=True)
        except Exception as exc:
            logger.warning(f"CRFS redis publish failed: {exc}")

    async def _ensure_redis_client(self):
        if self._redis_client is not None:
            return self._redis_client

        if not self._redis_url:
            return None

        try:
            redis_asyncio = importlib.import_module("redis.asyncio")
            Redis = getattr(redis_asyncio, "Redis")
        except Exception:
            logger.warning("CRFS redis package unavailable; using in-memory realtime hub only")
            return None

        try:
            self._redis_client = Redis.from_url(self._redis_url, decode_responses=True)
            await self._redis_client.ping()
            return self._redis_client
        except Exception as exc:
            logger.warning(f"CRFS redis connection failed: {exc}")
            self._redis_client = None
            return None


crfs_realtime_hub = CrfsRealtimeHub()
