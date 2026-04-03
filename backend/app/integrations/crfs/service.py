from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from app.core.websocket_manager import manager
from app.database import AsyncSessionLocal
from app.integrations.crfs.codec import decode_data_generic_payload
from app.integrations.crfs.realtime import CrfsRealtimeHub
from app.logging_config import logger
from app.services.crfs_service import process_decoded_message


class CrfsIngestService:
    def __init__(
        self,
        enabled: bool,
        host: str,
        port: int,
        idle_timeout_seconds: int,
        max_message_bytes: int,
        length_endian: str,
        signal_power_alert_threshold: float,
        aoa_delta_threshold_deg: float,
        redis_url: str | None = None,
        redis_stream: str = "crfs.events",
    ):
        self.enabled = enabled
        self.host = host
        self.port = port
        self.idle_timeout_seconds = idle_timeout_seconds
        self.max_message_bytes = max_message_bytes
        self.length_endian = "little" if str(length_endian).lower() == "little" else "big"
        self.signal_power_alert_threshold = signal_power_alert_threshold
        self.aoa_delta_threshold_deg = aoa_delta_threshold_deg

        self._server: asyncio.base_events.Server | None = None
        self._writers: set[asyncio.StreamWriter] = set()
        self._total_connections = 0
        self._frames_received = 0
        self._frames_processed = 0
        self._frames_rejected = 0
        self._frames_failed = 0
        self._last_message_at: datetime | None = None
        self._last_error: str | None = None

        self._previous_bearing_by_origin: dict[str, float] = {}
        self._seen_classifications_by_origin: dict[str, set[str]] = {}
        self.hub = CrfsRealtimeHub(redis_url=redis_url, redis_stream=redis_stream)

    async def start(self) -> None:
        if not self.enabled:
            logger.info("CRFS ingest disabled by configuration")
            return

        if self._server is not None:
            return

        self._server = await asyncio.start_server(
            self._handle_client,
            host=self.host,
            port=self.port,
        )
        logger.info(f"CRFS ingest started on {self.host}:{self.port}")

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
        logger.info("CRFS ingest stopped")

    async def enable_ingest(self) -> None:
        self.enabled = True
        await self.start()

    async def disable_ingest(self) -> None:
        self.enabled = False
        await self.stop()

    def health_snapshot(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "running": self._server is not None,
            "host": self.host,
            "port": self.port,
            "length_endian": self.length_endian,
            "active_connections": len(self._writers),
            "total_connections": self._total_connections,
            "frames_received": self._frames_received,
            "frames_processed": self._frames_processed,
            "frames_rejected": self._frames_rejected,
            "frames_failed": self._frames_failed,
            "max_message_bytes": self.max_message_bytes,
            "idle_timeout_seconds": self.idle_timeout_seconds,
            "last_message_at": self._last_message_at,
            "last_error": self._last_error,
            "realtime": self.hub.health(),
        }

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peer = writer.get_extra_info("peername")
        conn_id = f"{peer[0]}:{peer[1]}" if peer else "unknown"

        self._writers.add(writer)
        self._total_connections += 1
        logger.info(f"CRFS client connected: {conn_id}")

        try:
            while True:
                length_bytes = await self._read_with_timeout(reader, 4)
                if not length_bytes:
                    break

                self._frames_received += 1
                frame_length = int.from_bytes(length_bytes, byteorder=self.length_endian, signed=False)

                if frame_length <= 0 or frame_length > self.max_message_bytes:
                    self._frames_rejected += 1
                    self._last_error = f"Invalid frame length {frame_length} from {conn_id}"
                    logger.warning(self._last_error)
                    break

                payload = await self._read_with_timeout(reader, frame_length)
                if not payload:
                    self._frames_rejected += 1
                    break

                await self._process_frame(payload=payload, conn_id=conn_id)
        except asyncio.TimeoutError:
            self._last_error = f"CRFS client timeout: {conn_id}"
            logger.warning(self._last_error)
        except Exception as exc:
            self._last_error = f"CRFS client error ({conn_id}): {exc}"
            logger.warning(self._last_error)
        finally:
            self._writers.discard(writer)
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
            logger.info(f"CRFS client disconnected: {conn_id}")

    async def _process_frame(self, payload: bytes, conn_id: str) -> None:
        try:
            decoded = decode_data_generic_payload(payload)
            self._last_message_at = datetime.now(timezone.utc)

            async with AsyncSessionLocal() as db:
                processed = await process_decoded_message(
                    decoded=decoded,
                    db=db,
                    power_threshold=self.signal_power_alert_threshold,
                    aoa_delta_threshold_deg=self.aoa_delta_threshold_deg,
                    previous_bearing_by_origin=self._previous_bearing_by_origin,
                    seen_classifications_by_origin=self._seen_classifications_by_origin,
                )

            event = {
                "type": "crfs_ingest",
                "connection": conn_id,
                "message_name": decoded.name,
                "stream_guid": processed["stream_guid"],
                "origin_guid": processed["origin_guid"],
                "timestamp": processed["timestamp"],
                "signal_created": processed["signal_created"],
                "location_created": processed["location_created"],
                "event_created": processed["event_created"],
                "alerts_created": processed["alerts_created"],
                "summary": processed["summary"],
            }

            await self.hub.publish(event)
            await manager.broadcast({"event": "crfs_update", "payload": event})
            self._frames_processed += 1
        except Exception as exc:
            self._frames_failed += 1
            self._last_error = str(exc)
            logger.warning(f"CRFS frame processing failed from {conn_id}: {exc}")

    async def _read_with_timeout(self, reader: asyncio.StreamReader, size: int) -> bytes:
        if size <= 0:
            return b""

        try:
            return await asyncio.wait_for(reader.readexactly(size), timeout=self.idle_timeout_seconds)
        except asyncio.IncompleteReadError:
            return b""
