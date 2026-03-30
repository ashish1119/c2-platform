import asyncio
import json
from typing import Any

from geoalchemy2.elements import WKTElement

from app.core.websocket_manager import manager
from app.database import AsyncSessionLocal
from app.integrations.tcp_listener.models import TcpIncomingMessage
from app.logging_config import logger
from app.models import Alert


class TcpListenerService:
    def __init__(
        self,
        enabled: bool,
        host: str,
        port: int,
        idle_timeout_seconds: int,
        max_line_bytes: int,
    ):
        self.enabled = enabled
        self.host = host
        self.port = port
        self.idle_timeout_seconds = idle_timeout_seconds
        self.max_line_bytes = max_line_bytes

        self._server: asyncio.base_events.Server | None = None
        self._writers: set[asyncio.StreamWriter] = set()

        self._total_connections = 0
        self._messages_received = 0
        self._messages_rejected = 0

        # ✅ NEW (for client status API)
        self._last_message_at = None
        self._last_error = None
        self._recent_messages: list[dict] = []

    async def start(self) -> None:
        if not self.enabled:
            logger.info("TCP listener disabled by configuration")
            return

        self._server = await asyncio.start_server(
            self._handle_client,
            host=self.host,
            port=self.port,
            limit=self.max_line_bytes,
        )
        logger.info(f"TCP listener started on {self.host}:{self.port}")

    async def stop(self) -> None:
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            self._server = None

        for writer in list(self._writers):
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

        self._writers.clear()
        logger.info("TCP listener stopped")

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peer = writer.get_extra_info("peername")
        conn_id = f"{peer[0]}:{peer[1]}" if peer else "unknown"

        self._writers.add(writer)
        self._total_connections += 1

        logger.info(f"TCP client connected: {conn_id}")

        try:
            while True:
                raw = await asyncio.wait_for(reader.readline(), timeout=self.idle_timeout_seconds)
                if not raw:
                    break

                if len(raw) > self.max_line_bytes:
                    logger.warning(f"TCP frame too large from {conn_id}: {len(raw)} bytes")
                    self._messages_rejected += 1
                    break

                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                await self._process_message_line(line, conn_id)

        except asyncio.TimeoutError:
            logger.warning(f"TCP client idle timeout: {conn_id}")
        except Exception as exc:
            logger.warning(f"TCP client error ({conn_id}): {exc}")
            self._last_error = str(exc)
        finally:
            self._writers.discard(writer)
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

            logger.info(f"TCP client disconnected: {conn_id}")

    async def _process_message_line(self, line: str, conn_id: str) -> None:
        try:
            payload: dict[str, Any] = json.loads(line)
            message = TcpIncomingMessage(**payload)

            self._messages_received += 1
            self._last_message_at = message.ts.isoformat()

            # ✅ Store recent messages (last 20)
            self._recent_messages.append({
                "sender_id": message.sender_id,
                "event_type": message.event_type,
                "value": message.value,
                "timestamp": message.ts.isoformat(),
            })
            self._recent_messages = self._recent_messages[-20:]

        except Exception as exc:
            logger.warning(f"TCP invalid message from {conn_id}: {exc}")
            self._messages_rejected += 1
            self._last_error = str(exc)
            return

        severity = self._resolve_severity(message)
        alert_type, alert_name = self._resolve_alert_identity(message.event_type)
        description = self._build_alert_description(message, alert_type)

        location = None
        if message.latitude is not None and message.longitude is not None:
            location = WKTElement(f"POINT({message.longitude} {message.latitude})", srid=4326)

        async with AsyncSessionLocal() as session:
            alert = Alert(
                alert_name=alert_name,
                alert_type=alert_type,
                severity=severity,
                status="NEW",
                description=description,
                location=location,
            )
            session.add(alert)
            await session.commit()
            await session.refresh(alert)

            await manager.broadcast(
                {
                    "type": "tcp_alert",
                    "id": str(alert.id),
                    "severity": alert.severity,
                    "status": alert.status,
                    "description": alert.description,
                    "sender_id": message.sender_id,
                    "source_name": message.source_name,
                    "source_type": message.source_type,
                    "source_details": message.source_details,
                    "event_type": message.event_type,
                    "msg_id": message.msg_id,
                    "timestamp": message.ts.isoformat(),
                }
            )

    # ✅ EXISTING
    def get_health_snapshot(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "running": self._server is not None,
            "host": self.host,
            "port": self.port,
            "active_connections": len(self._writers),
            "total_connections": self._total_connections,
            "messages_received": self._messages_received,
            "messages_rejected": self._messages_rejected,
            "idle_timeout_seconds": self.idle_timeout_seconds,
            "max_line_bytes": self.max_line_bytes,
        }

    # ✅ NEW (THIS FIXES YOUR ERROR)
    def get_client_snapshot(self) -> dict[str, Any]:
        return {
            "connected": len(self._writers) > 0,
            "target_host": self.host,
            "target_port": self.port,
            "messages_received": self._messages_received,
            "messages_rejected": self._messages_rejected,
            "last_message_at": self._last_message_at,
            "last_error": self._last_error,
            "recent_messages": self._recent_messages,
        }

    @staticmethod
    def _resolve_alert_identity(event_type: str) -> tuple[str, str]:
        normalized = event_type.strip().lower()
        if normalized in {"df", "direction_finder", "bearing", "aoa", "doa"}:
            return "DIRECTION_FINDER", "Direction Finder Alert"

        event_upper = event_type.strip().upper()
        return event_upper, f"{event_upper} alert"

    @staticmethod
    def _build_alert_description(message: TcpIncomingMessage, alert_type: str) -> str:
        source_name = message.source_name or message.sender_id
        source_type = message.source_type or "UNKNOWN"

        if alert_type == "DIRECTION_FINDER":
            return f"DF from {message.sender_id}: bearing={message.value} {message.unit}"

        return f"{message.event_type} from {source_name}: {message.value} {message.unit}"

    @staticmethod
    def _resolve_severity(message: TcpIncomingMessage) -> str:
        if message.severity_hint:
            return message.severity_hint

        if message.event_type.lower() in {"df", "doa"}:
            return "MEDIUM"

        if message.event_type.lower() == "temperature":
            if message.value >= 95:
                return "CRITICAL"
            if message.value >= 85:
                return "HIGH"
            return "MEDIUM"

        return "MEDIUM"