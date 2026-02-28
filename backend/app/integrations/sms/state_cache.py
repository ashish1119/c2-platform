from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class SmsAdapterStateCache:
    node_metrics: dict[str, dict[str, Any]] = field(default_factory=dict)
    node_last_seen: dict[str, datetime] = field(default_factory=dict)
    processed_messages: int = 0
    accepted_detections: int = 0
    rejected_detections: int = 0
    last_message_at: datetime | None = None
    last_error: str | None = None

    def mark_node_heartbeat(self, source_node: str, timestamp: datetime, metrics: dict[str, Any] | None = None) -> None:
        self.node_last_seen[source_node] = timestamp
        if metrics is not None:
            existing = dict(self.node_metrics.get(source_node, {}))
            existing.update(metrics)
            self.node_metrics[source_node] = existing

    def increment_processed(self) -> None:
        self.processed_messages += 1

    def increment_accepted(self) -> None:
        self.accepted_detections += 1

    def increment_rejected(self) -> None:
        self.rejected_detections += 1

    def mark_message_time(self, timestamp: datetime) -> None:
        self.last_message_at = timestamp

    def set_error(self, error: str | None) -> None:
        self.last_error = error

    def snapshot(self, running: bool, queue_depth: int = 0) -> dict[str, Any]:
        return {
            "running": running,
            "queue_depth": queue_depth,
            "processed_messages": self.processed_messages,
            "accepted_detections": self.accepted_detections,
            "rejected_detections": self.rejected_detections,
            "last_message_at": self.last_message_at,
            "last_error": self.last_error,
            "nodes": [
                {
                    "source_node": source_node,
                    "last_seen": self.node_last_seen.get(source_node),
                    "metrics": self.node_metrics.get(source_node, {}),
                }
                for source_node in sorted(self.node_last_seen.keys())
            ],
        }
