import asyncio
from collections import deque
import json
from datetime import datetime, timezone
import re
from typing import Any

from geoalchemy2.elements import WKTElement

from app.core.websocket_manager import manager
from app.database import AsyncSessionLocal
from app.integrations.crfs.codec import decode_data_generic_payload
from app.integrations.tcp_listener.models import TcpIncomingMessage
from app.logging_config import logger
from app.models import Alert


class TcpListenerService:
    _CLIENT_PROTO_FRAME_LIMIT_BYTES = 2_097_152

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
        self._client_task: asyncio.Task | None = None
        self._client_writer: asyncio.StreamWriter | None = None
        self._client_connected = False
        self._client_target_host: str | None = None
        self._client_target_port: int | None = None
        self._client_protocol = "line"
        self._client_length_endian = "little"
        self._client_messages_received = 0
        self._client_messages_rejected = 0
        self._client_last_message_at: datetime | None = None
        self._client_last_error: str | None = None
        self._client_recent_messages: deque[dict[str, Any]] = deque(maxlen=50)

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
        await self.disconnect_client()

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

    async def connect_client(
        self,
        host: str,
        port: int,
        protocol: str = "line",
        length_endian: str = "little",
    ) -> None:
        host = host.strip()
        if not host:
            raise ValueError("host is required")

        protocol = str(protocol).strip().lower()
        if protocol not in {"line", "proto"}:
            raise ValueError("protocol must be 'line' or 'proto'")

        length_endian = str(length_endian).strip().lower()
        if length_endian not in {"big", "little"}:
            raise ValueError("length_endian must be 'big' or 'little'")

        await self.disconnect_client()

        self._client_target_host = host
        self._client_target_port = port
        self._client_protocol = protocol
        self._client_length_endian = length_endian
        self._client_last_error = None

        try:
            reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=5)
        except Exception as exc:
            self._client_last_error = str(exc)
            raise

        self._client_writer = writer
        self._client_connected = True
        self._client_task = asyncio.create_task(
            self._run_client_reader(
                reader,
                writer,
                host,
                port,
                protocol=protocol,
                length_endian=length_endian,
            )
        )
        logger.info(f"TCP outbound client connected to {host}:{port} (protocol={protocol}, endian={length_endian})")

    async def disconnect_client(self) -> None:
        task = self._client_task
        self._client_task = None

        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        writer = self._client_writer
        self._client_writer = None
        if writer is not None:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

        self._client_connected = False

    async def _run_client_reader(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
        host: str,
        port: int,
        protocol: str,
        length_endian: str,
    ) -> None:
        conn_id = f"client:{host}:{port}"
        try:
            if protocol == "proto":
                await self._run_proto_reader(reader=reader, conn_id=conn_id, length_endian=length_endian)
            else:
                await self._run_line_reader(reader=reader, conn_id=conn_id)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            self._client_last_error = str(exc)
            logger.warning(f"TCP outbound client error ({conn_id}): {exc}")
        finally:
            if self._client_writer is writer:
                self._client_writer = None
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
            self._client_connected = False
            logger.info(f"TCP outbound client disconnected from {host}:{port}")

    async def _run_line_reader(self, reader: asyncio.StreamReader, conn_id: str) -> None:
        while True:
            raw = await reader.readline()
            if not raw:
                break

            if len(raw) > self.max_line_bytes:
                self._client_messages_rejected += 1
                self._messages_rejected += 1
                logger.warning(f"TCP outbound client frame too large from {conn_id}: {len(raw)} bytes")
                continue

            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue

            self._client_messages_received += 1
            self._client_last_message_at = datetime.now(timezone.utc)
            self._client_recent_messages.append(self._build_client_frame_snapshot(raw, self._client_last_message_at))

            # Attempt alert ingestion only for JSON-like frames.
            frame = raw.strip()
            if self._looks_like_json(frame):
                json_line = frame.decode("utf-8", errors="replace").strip()
                processed = await self._process_message_line(json_line, conn_id)
                if not processed:
                    self._client_messages_rejected += 1

    async def _run_proto_reader(self, reader: asyncio.StreamReader, conn_id: str, length_endian: str) -> None:
        while True:
            length_bytes = await self._read_with_timeout(reader, 4)
            if not length_bytes:
                break

            frame_length = int.from_bytes(length_bytes, byteorder=length_endian, signed=False)
            if frame_length <= 0 or frame_length > self._CLIENT_PROTO_FRAME_LIMIT_BYTES:
                self._client_messages_rejected += 1
                self._client_last_error = f"Invalid proto frame length {frame_length} from {conn_id}"
                logger.warning(self._client_last_error)
                break

            payload = await self._read_with_timeout(reader, frame_length)
            if not payload:
                self._client_messages_rejected += 1
                break

            self._client_messages_received += 1
            self._client_last_message_at = datetime.now(timezone.utc)

            decoded_fields: dict[str, str] = {}
            decode_error: str | None = None

            try:
                decoded = decode_data_generic_payload(payload)
                if decoded.name:
                    decoded_fields["Name"] = str(decoded.name)
                if decoded.stream_name:
                    decoded_fields["Stream"] = str(decoded.stream_name)
                if decoded.origin_name:
                    decoded_fields["Origin"] = str(decoded.origin_name)
                if decoded.unix_time is not None:
                    decoded_fields["UnixTime"] = f"{decoded.unix_time:.3f}"

                # Include a compact view of telemetry fields for operator readability.
                for key, value in list(decoded.telemetry.items())[:10]:
                    if isinstance(value, list):
                        shown = ", ".join(str(item) for item in value[:4])
                        if len(value) > 4:
                            shown = f"{shown}, ..."
                        decoded_fields[key] = shown[:128]
                    else:
                        decoded_fields[key] = str(value)[:128]
            except Exception as exc:
                decode_error = str(exc)
                decoded_fields["DecodeError"] = decode_error[:160]
                self._client_messages_rejected += 1
                logger.warning(f"TCP outbound proto decode failed ({conn_id}): {exc}")

            self._client_recent_messages.append(
                self._build_proto_client_frame_snapshot(
                    payload=payload,
                    received_at=self._client_last_message_at,
                    parsed_fields=decoded_fields,
                    decode_error=decode_error,
                )
            )

    def get_client_snapshot(self) -> dict[str, Any]:
        return {
            "connected": self._client_connected,
            "target_host": self._client_target_host,
            "target_port": self._client_target_port,
            "protocol": self._client_protocol,
            "length_endian": self._client_length_endian,
            "messages_received": self._client_messages_received,
            "messages_rejected": self._client_messages_rejected,
            "last_message_at": self._client_last_message_at.isoformat() if self._client_last_message_at else None,
            "last_error": self._client_last_error,
            "recent_messages": list(self._client_recent_messages),
        }

    @staticmethod
    def _looks_like_json(raw: bytes) -> bool:
        stripped = raw.lstrip()
        return stripped.startswith(b"{") or stripped.startswith(b"[")

    @staticmethod
    def _extract_ascii_segments(raw: bytes, min_length: int = 4) -> list[str]:
        segments: list[str] = []
        current: list[str] = []

        for byte in raw:
            if 32 <= byte <= 126:
                current.append(chr(byte))
                continue

            if len(current) >= min_length:
                segments.append("".join(current).strip())
            current = []

        if len(current) >= min_length:
            segments.append("".join(current).strip())

        return [segment for segment in segments if segment]

    @staticmethod
    def _extract_key_values(segments: list[str]) -> dict[str, str]:
        parsed: dict[str, str] = {}
        for segment in segments:
            match = re.match(r"^([A-Za-z][A-Za-z0-9 _/\\-]{1,64})\s*[:=]\s*(.+)$", segment)
            if not match:
                continue

            key = match.group(1).strip()
            value = match.group(2).strip()
            if key and value:
                parsed[key] = value[:128]
        return parsed

    def _build_client_frame_snapshot(self, raw: bytes, received_at: datetime) -> dict[str, Any]:
        ascii_segments = self._extract_ascii_segments(raw)
        ascii_preview = " | ".join(ascii_segments[:4])
        parsed_fields = self._extract_key_values(ascii_segments)
        text_preview = raw.decode("utf-8", errors="replace")[:256].strip()

        return {
            "received_at": received_at.isoformat(),
            "protocol": "line",
            "byte_length": len(raw),
            "raw": text_preview,
            "ascii_preview": ascii_preview,
            "hex_preview": raw[:96].hex(" "),
            "parsed_fields": parsed_fields,
        }

    def _build_proto_client_frame_snapshot(
        self,
        payload: bytes,
        received_at: datetime,
        parsed_fields: dict[str, str],
        decode_error: str | None,
    ) -> dict[str, Any]:
        ascii_segments = self._extract_ascii_segments(payload)
        ascii_preview = " | ".join(ascii_segments[:4])
        snapshot: dict[str, Any] = {
            "received_at": received_at.isoformat(),
            "protocol": "proto",
            "byte_length": len(payload),
            "raw": payload.decode("utf-8", errors="replace")[:256].strip(),
            "ascii_preview": ascii_preview,
            "hex_preview": payload[:128].hex(" "),
            "parsed_fields": parsed_fields,
        }
        if decode_error:
            snapshot["decode_error"] = decode_error
        return snapshot

    async def _read_with_timeout(self, reader: asyncio.StreamReader, size: int) -> bytes:
        if size <= 0:
            return b""
        try:
            return await asyncio.wait_for(reader.readexactly(size), timeout=self.idle_timeout_seconds)
        except asyncio.IncompleteReadError:
            return b""

    async def update_endpoint(self, host: str, port: int) -> None:
        host = host.strip()
        if not host:
            raise ValueError("host is required")

        previous_host = self.host
        previous_port = self.port
        was_running = self._server is not None

        if previous_host == host and previous_port == port:
            return

        self.host = host
        self.port = port

        if not self.enabled:
            return

        if not was_running:
            await self.start()
            return

        await self.stop()
        try:
            await self.start()
        except Exception:
            self.host = previous_host
            self.port = previous_port
            # Best-effort rollback to the previous endpoint.
            await self.start()
            raise

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
        finally:
            self._writers.discard(writer)
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
            logger.info(f"TCP client disconnected: {conn_id}")

    async def _process_message_line(self, line: str, conn_id: str) -> bool:
        try:
            payload: dict[str, Any] = json.loads(line)
            message = TcpIncomingMessage(**payload)
            self._messages_received += 1
        except Exception as exc:
            logger.warning(f"TCP invalid message from {conn_id}: {exc}")
            self._messages_rejected += 1
            return False

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

        return True

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

    @staticmethod
    def _resolve_alert_identity(event_type: str) -> tuple[str, str]:
        normalized = event_type.strip().lower()
        direction_finder_aliases = {
            "df",
            "direction_finder",
            "direction-finder",
            "directionfinder",
            "bearing",
            "aoa",
            "doa",
        }
        if normalized in direction_finder_aliases:
            return "DIRECTION_FINDER", "Direction Finder Alert"

        event_upper = event_type.strip().upper()
        return event_upper, f"{event_upper} alert"

    @staticmethod
    def _build_alert_description(message: TcpIncomingMessage, alert_type: str) -> str:
        source_name = message.source_name or message.sender_id
        source_type = message.source_type or "UNKNOWN"
        source_parts = [f"source_name={source_name}", f"source_type={source_type}"]
        if message.source_details:
            detail_pairs = [f"{key}={value}" for key, value in message.source_details.items()]
            if detail_pairs:
                source_parts.append("source_details=" + ";".join(detail_pairs))
        source_summary = " | ".join(source_parts)

        if alert_type == "DIRECTION_FINDER":
            value_with_unit = f"{message.value}{(' ' + message.unit) if message.unit else ''}"
            return (
                f"Direction Finder detection from {message.sender_id}: "
                f"bearing={value_with_unit}, msg_id={message.msg_id} | {source_summary}"
            )

        return (
            f"TCP event={message.event_type} sender={message.sender_id} "
            f"value={message.value}{(' ' + message.unit) if message.unit else ''} | {source_summary}"
        )

    @staticmethod
    def _resolve_severity(message: TcpIncomingMessage) -> str:
        if message.severity_hint:
            return message.severity_hint

        event_type = message.event_type.lower()
        value = message.value

        if event_type in {"df", "direction_finder", "direction-finder", "directionfinder", "bearing", "aoa", "doa"}:
            if value < 0 or value >= 360:
                return "HIGH"
            return "MEDIUM"

        if event_type == "temperature":
            if value >= 95:
                return "CRITICAL"
            if value >= 85:
                return "HIGH"
            if value >= 75:
                return "MEDIUM"
            return "LOW"

        if event_type == "packet_loss":
            if value >= 20:
                return "CRITICAL"
            if value >= 10:
                return "HIGH"
            if value >= 5:
                return "MEDIUM"
            return "LOW"

        return "MEDIUM"
