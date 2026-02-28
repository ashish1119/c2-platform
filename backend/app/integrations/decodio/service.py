from datetime import datetime, timezone
from typing import Any

from geoalchemy2.elements import WKTElement

from app.core.websocket_manager import manager
from app.database import AsyncSessionLocal
from app.models import Alert
from app.schemas import RFSignalCreate
from app.integrations.decodio.models import DecodioConnectionHealth
from app.integrations.decodio.state_cache import DecodioStateCache
from app.integrations.decodio.transport import DecodioTransport
from app.logging_config import logger
from app.services.rf_service import ingest_signal


class DecodioIntegrationService:
    def __init__(
        self,
        enabled: bool,
        host: str,
        port: int,
        connect_timeout: float,
        read_timeout: float,
        heartbeat_interval: int,
        reconnect_max_seconds: int,
        ack_timeout_seconds: float,
        json_format: str = "auto",
        event_aliases: dict[str, list[str]] | None = None,
    ):
        self.enabled = enabled
        self.host = host
        self.port = port
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.heartbeat_interval = heartbeat_interval
        self.reconnect_max_seconds = reconnect_max_seconds
        self.ack_timeout_seconds = ack_timeout_seconds
        self.json_format = json_format
        self.event_aliases = event_aliases or {}
        self.cache = DecodioStateCache()
        self.transport = self._build_transport()

    def _build_transport(self) -> DecodioTransport:
        return DecodioTransport(
            host=self.host,
            port=self.port,
            connect_timeout=self.connect_timeout,
            read_timeout=self.read_timeout,
            heartbeat_interval=self.heartbeat_interval,
            reconnect_max_seconds=self.reconnect_max_seconds,
            ack_timeout_seconds=self.ack_timeout_seconds,
            on_message=self._handle_message,
            on_connected=self._on_connected,
        )

    async def apply_runtime_config(
        self,
        enabled: bool,
        host: str,
        port: int,
        connect_timeout: float,
        read_timeout: float,
        heartbeat_interval: int,
        reconnect_max_seconds: int,
        ack_timeout_seconds: float,
        json_format: str,
        event_aliases: dict[str, list[str]] | None,
    ) -> None:
        await self.transport.stop()

        self.enabled = enabled
        self.host = host
        self.port = port
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.heartbeat_interval = heartbeat_interval
        self.reconnect_max_seconds = reconnect_max_seconds
        self.ack_timeout_seconds = ack_timeout_seconds
        self.json_format = json_format
        self.event_aliases = event_aliases or {}

        self.transport = self._build_transport()
        if self.enabled:
            await self.transport.start()

    async def start(self) -> None:
        if not self.enabled:
            logger.info("Decodio integration disabled by configuration")
            return
        await self.transport.start()

    async def stop(self) -> None:
        await self.transport.stop()

    async def _on_connected(self) -> None:
        logger.info("Decodio connected, running bootstrap sync")
        try:
            await self.get_carrier_info()
            self.cache.mark_synced()
        except Exception as exc:
            logger.warning(f"Decodio bootstrap sync failed: {exc}")

    async def _handle_message(self, message: dict[str, Any]) -> None:
        name = self._extract_message_name(message)
        payload = self._extract_payload(message)

        if not name:
            return

        if self._is_event(name, "callInfo"):
            await self.handle_call_info(payload)
        elif self._is_event(name, "dataInfo"):
            await self.handle_data_info(payload)
        elif self._is_event(name, "triggerUpdate"):
            await self.handle_trigger_update(payload)
        elif self._is_event(name, "slotInfo"):
            await self.handle_slot_info(payload)
        elif self._is_event(name, "laInfo"):
            await self.handle_la_info(payload)
        elif self._is_event(name, "LiveChanged"):
            await self.handle_live_changed(payload)

    def _extract_message_name(self, message: dict[str, Any]) -> str | None:
        for key in ("name", "method", "event", "type", "action"):
            value = message.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _extract_payload(self, message: dict[str, Any]) -> dict[str, Any]:
        if self.json_format == "payload":
            payload = message.get("payload")
            return payload if isinstance(payload, dict) else {}
        if self.json_format == "data":
            payload = message.get("data")
            return payload if isinstance(payload, dict) else {}
        if self.json_format == "root":
            return {k: v for k, v in message.items() if k not in {"name", "method", "event", "type", "action", "requestId", "timestamp", "messageType"}}

        payload = message.get("payload")
        if isinstance(payload, dict) and payload:
            return payload
        data = message.get("data")
        if isinstance(data, dict) and data:
            return data
        return {k: v for k, v in message.items() if k not in {"name", "method", "event", "type", "action", "requestId", "timestamp", "messageType"}}

    def _is_event(self, incoming: str, canonical: str) -> bool:
        aliases = self.event_aliases.get(canonical) or [canonical]
        normalized_incoming = incoming.lower()
        return any(alias.lower() == normalized_incoming for alias in aliases)

    @staticmethod
    def _get_first(payload: dict[str, Any], keys: list[str]) -> Any:
        for key in keys:
            if key in payload and payload[key] is not None:
                return payload[key]
        return None

    @staticmethod
    def _as_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _extract_entity_id(payload: dict[str, Any], keys: list[str]) -> str | None:
        value = DecodioIntegrationService._get_first(payload, keys)
        if value is None:
            return None
        return str(value)

    async def modify_device(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self.transport.send_command("modifyDevice", payload)
        if response.get("success", True):
            device_id = self._extract_entity_id(payload, ["deviceId", "id"])
            if device_id:
                self.cache.upsert_device(device_id, payload)
        return response

    async def start_device(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self.transport.send_command("startDevice", payload)
        if response.get("success", True):
            device_id = self._extract_entity_id(payload, ["deviceId", "id"])
            if device_id:
                existing = self.cache.devices.get(device_id, {})
                self.cache.upsert_device(device_id, {**existing, **payload, "runtimeState": "RUNNING"})
        return response

    async def stop_device(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self.transport.send_command("stopDevice", payload)
        if response.get("success", True):
            device_id = self._extract_entity_id(payload, ["deviceId", "id"])
            if device_id:
                existing = self.cache.devices.get(device_id, {})
                self.cache.upsert_device(device_id, {**existing, **payload, "runtimeState": "STOPPED"})
        return response

    async def delete_device(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self.transport.send_command("deleteDevice", payload)
        if response.get("success", True):
            device_id = self._extract_entity_id(payload, ["deviceId", "id"])
            if device_id:
                self.cache.remove_device(device_id)
        return response

    async def modify_stream(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self.transport.send_command("modifyStream", payload)
        if response.get("success", True):
            stream_id = self._extract_entity_id(payload, ["streamId", "id"])
            if stream_id:
                self.cache.upsert_stream(stream_id, payload)
        return response

    async def delete_stream(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self.transport.send_command("deleteStream", payload)
        if response.get("success", True):
            stream_id = self._extract_entity_id(payload, ["streamId", "id"])
            if stream_id:
                self.cache.remove_stream(stream_id)
        return response

    async def get_carrier_info(self) -> dict[str, Any]:
        return await self.transport.send_command("GetCarrierInfo", {})

    async def add_neighbour_streams(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.transport.send_command("AddNeighbourStreams", payload)

    async def seed_test_events(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)

        await self.handle_la_info(
            {
                "deviceId": "decodio-device-1",
                "name": "Decodio Receiver Alpha",
                "runtimeState": "RUNNING",
                "latitude": 12.9716,
                "longitude": 77.5946,
            }
        )
        await self.handle_slot_info(
            {
                "streamId": "decodio-stream-1",
                "name": "Primary Stream",
                "status": "ACTIVE",
            }
        )

        await self.handle_call_info(
            {
                "frequency": 151_500_000,
                "powerLevel": -49.5,
                "modulation": "FM",
                "bandwidthHz": 25000,
                "confidence": 0.91,
                "doaDeg": 36,
                "lat": 12.9722,
                "lon": 77.5951,
                "timestamp": now.isoformat(),
            }
        )
        await self.handle_data_info(
            {
                "frequency": 433_920_000,
                "power": -61.2,
                "mode": "DATA",
                "bandwidth": 125000,
                "confidence": 0.77,
                "doa": 241,
                "latitude": 12.9702,
                "longitude": 77.6025,
                "time": now.isoformat(),
            }
        )

        await self.handle_trigger_update(
            {
                "severity": "HIGH",
                "description": "Decodio test trigger near central command",
                "latitude": 12.9716,
                "longitude": 77.5946,
            }
        )
        await self.handle_trigger_update(
            {
                "level": "MEDIUM",
                "message": "Decodio test trigger near relay corridor",
                "lat": 12.9648,
                "lng": 77.6087,
            }
        )

        await self.handle_live_changed(
            {
                "deviceId": "decodio-device-1",
                "runtimeState": "RUNNING",
                "health": "GOOD",
            }
        )

        return {
            "seeded": True,
            "events": {
                "laInfo": 1,
                "slotInfo": 1,
                "callInfo": 1,
                "dataInfo": 1,
                "triggerUpdate": 2,
                "LiveChanged": 1,
            },
            "note": "Seeded Decodio sample events for alerts, map blink, RF signals, and cache updates.",
        }

    async def handle_call_info(self, payload: dict[str, Any]) -> None:
        await self._try_ingest_rf_signal(payload, modulation_default="CALL")

    async def handle_data_info(self, payload: dict[str, Any]) -> None:
        await self._try_ingest_rf_signal(payload, modulation_default="DATA")

    async def handle_trigger_update(self, payload: dict[str, Any]) -> None:
        severity = str(self._get_first(payload, ["severity", "level", "priority"]) or "MEDIUM").upper()
        description = str(self._get_first(payload, ["description", "message", "triggerName"]) or "Decodio trigger update")
        status = "NEW"

        latitude = self._as_float(self._get_first(payload, ["latitude", "lat"]))
        longitude = self._as_float(self._get_first(payload, ["longitude", "lon", "lng"]))
        location = None
        if latitude is not None and longitude is not None:
            location = WKTElement(f"POINT({longitude} {latitude})", srid=4326)

        async with AsyncSessionLocal() as session:
            alert = Alert(
                alert_name=description,
                alert_type="DECODIO_TRIGGER",
                severity=severity,
                status=status,
                description=description,
                location=location,
            )
            session.add(alert)
            await session.commit()
            await session.refresh(alert)

        await manager.broadcast(
            {
                "event": "decodio_trigger_update",
                "alert_id": str(alert.id),
                "severity": severity,
                "description": description,
                "latitude": latitude,
                "longitude": longitude,
                "blink": True,
            }
        )

    async def handle_slot_info(self, payload: dict[str, Any]) -> None:
        stream_id = self._extract_entity_id(payload, ["streamId", "id", "slotId"])
        if stream_id:
            self.cache.upsert_stream(stream_id, payload)

    async def handle_la_info(self, payload: dict[str, Any]) -> None:
        device_id = self._extract_entity_id(payload, ["deviceId", "id", "laId"])
        if device_id:
            self.cache.upsert_device(device_id, payload)

    async def handle_live_changed(self, payload: dict[str, Any]) -> None:
        entity_id = self._extract_entity_id(payload, ["deviceId", "streamId", "id"])
        if entity_id:
            self.cache.upsert_device(entity_id, payload)

    async def _try_ingest_rf_signal(self, payload: dict[str, Any], modulation_default: str) -> None:
        frequency = self._as_float(self._get_first(payload, ["frequency", "carrierFreq", "frequencyHz"]))
        power_level = self._as_float(self._get_first(payload, ["powerLevel", "power", "rssi"]))
        latitude = self._as_float(self._get_first(payload, ["latitude", "lat"]))
        longitude = self._as_float(self._get_first(payload, ["longitude", "lon", "lng"]))

        if None in (frequency, power_level, latitude, longitude):
            logger.info(f"Decodio event skipped for RF ingest due to missing required fields: keys={list(payload.keys())}")
            return

        modulation = str(self._get_first(payload, ["modulation", "mode"]) or modulation_default)
        bandwidth_hz = self._as_float(self._get_first(payload, ["bandwidth_hz", "bandwidthHz", "bandwidth"]))
        confidence = self._as_float(self._get_first(payload, ["confidence"]))
        doa_deg = self._as_float(self._get_first(payload, ["doa_deg", "doaDeg", "doa"]))

        detected_at_raw = self._get_first(payload, ["detected_at", "timestamp", "time"])
        if isinstance(detected_at_raw, str):
            try:
                detected_at = datetime.fromisoformat(detected_at_raw.replace("Z", "+00:00"))
            except ValueError:
                detected_at = datetime.now(timezone.utc)
        else:
            detected_at = datetime.now(timezone.utc)

        signal = RFSignalCreate(
            frequency=frequency,
            modulation=modulation,
            power_level=power_level,
            bandwidth_hz=bandwidth_hz,
            confidence=confidence if confidence is not None else 0.5,
            doa_deg=doa_deg,
            latitude=latitude,
            longitude=longitude,
            detected_at=detected_at,
        )

        async with AsyncSessionLocal() as session:
            await ingest_signal(signal, session)

    def health(self) -> DecodioConnectionHealth:
        transport_health = self.transport.health()
        return DecodioConnectionHealth(enabled=self.enabled, **transport_health)
