from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class DecodioStateCache:
    devices: dict[str, dict[str, Any]] = field(default_factory=dict)
    streams: dict[str, dict[str, Any]] = field(default_factory=dict)
    last_sync_at: datetime | None = None

    def upsert_device(self, device_id: str, payload: dict[str, Any]) -> None:
        self.devices[device_id] = payload

    def upsert_stream(self, stream_id: str, payload: dict[str, Any]) -> None:
        self.streams[stream_id] = payload

    def remove_device(self, device_id: str) -> None:
        self.devices.pop(device_id, None)

    def remove_stream(self, stream_id: str) -> None:
        self.streams.pop(stream_id, None)

    def mark_synced(self) -> None:
        self.last_sync_at = datetime.now(timezone.utc)

    def snapshot(self) -> dict[str, Any]:
        return {
            "device_count": len(self.devices),
            "stream_count": len(self.streams),
            "last_sync_at": self.last_sync_at,
        }
