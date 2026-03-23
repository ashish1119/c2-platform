import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib import error as urllib_error
from uuid import uuid4

from app.database import AsyncSessionLocal
from app.integrations.sms.realtime import sms_realtime_hub
from app.integrations.sms.service import ingest_sms_adapter_batch
from app.integrations.sms.stream_utils import derive_source_node_from_url, fetch_stream_payload
from app.schemas import SmsAdapterIngestRequest


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class SmsStreamSession:
    session_id: str
    stream_url: str
    source_node: str
    metrics: dict[str, Any]
    pull_interval_seconds: float
    timeout_seconds: float
    retry_max_seconds: float

    started_at: datetime = field(default_factory=utc_now)
    last_pull_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error: str | None = None
    consecutive_failures: int = 0
    detections_fetched_total: int = 0
    accepted_total: int = 0
    rejected_total: int = 0
    payload_format: str | None = None
    status: str = "running"
    task: asyncio.Task | None = None

    def snapshot(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "stream_url": self.stream_url,
            "source_node": self.source_node,
            "metrics": self.metrics,
            "pull_interval_seconds": self.pull_interval_seconds,
            "timeout_seconds": self.timeout_seconds,
            "status": self.status,
            "started_at": self.started_at,
            "last_pull_at": self.last_pull_at,
            "last_success_at": self.last_success_at,
            "last_error": self.last_error,
            "consecutive_failures": self.consecutive_failures,
            "detections_fetched_total": self.detections_fetched_total,
            "accepted_total": self.accepted_total,
            "rejected_total": self.rejected_total,
            "payload_format": self.payload_format,
        }


class SmsStreamWorkerService:
    def __init__(self, retry_max_seconds: float = 30.0):
        self.retry_max_seconds = max(1.0, retry_max_seconds)
        self._running = False
        self._sessions: dict[str, SmsStreamSession] = {}
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        self._running = True

    async def stop(self) -> None:
        self._running = False
        async with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()

        for session in sessions:
            if session.task is not None and not session.task.done():
                session.task.cancel()
                try:
                    await session.task
                except asyncio.CancelledError:
                    pass

    def is_running(self) -> bool:
        return self._running

    async def start_session(
        self,
        stream_url: str,
        source_node: str | None,
        metrics: dict[str, Any],
        pull_interval_seconds: float,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        if not self._running:
            raise RuntimeError("SMS stream worker is not running")

        resolved_source_node = source_node.strip() if source_node and source_node.strip() else derive_source_node_from_url(stream_url)
        session_id = uuid4().hex

        session = SmsStreamSession(
            session_id=session_id,
            stream_url=stream_url,
            source_node=resolved_source_node,
            metrics=dict(metrics),
            pull_interval_seconds=max(0.5, pull_interval_seconds),
            timeout_seconds=max(1.0, timeout_seconds),
            retry_max_seconds=self.retry_max_seconds,
        )

        async with self._lock:
            self._sessions[session_id] = session
            session.task = asyncio.create_task(self._run_session_loop(session), name=f"sms-stream-session-{session_id}")

        await sms_realtime_hub.publish({
            "type": "sms_stream_session_started",
            "session": session.snapshot(),
        })
        return session.snapshot()

    async def stop_session(self, session_id: str) -> dict[str, Any] | None:
        async with self._lock:
            session = self._sessions.pop(session_id, None)

        if session is None:
            return None

        session.status = "stopped"
        if session.task is not None and not session.task.done():
            session.task.cancel()
            try:
                await session.task
            except asyncio.CancelledError:
                pass

        snapshot = session.snapshot()
        await sms_realtime_hub.publish({
            "type": "sms_stream_session_stopped",
            "session": snapshot,
        })
        return snapshot

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        async with self._lock:
            session = self._sessions.get(session_id)
            return None if session is None else session.snapshot()

    async def list_sessions(self) -> list[dict[str, Any]]:
        async with self._lock:
            sessions = [session.snapshot() for session in self._sessions.values()]

        sessions.sort(key=lambda item: item["started_at"], reverse=True)
        return sessions

    async def health_snapshot(self) -> dict[str, Any]:
        sessions = await self.list_sessions()
        return {
            "running": self._running,
            "active_sessions": len(sessions),
            "sessions": sessions,
        }

    async def _run_session_loop(self, session: SmsStreamSession) -> None:
        while self._running:
            try:
                session.last_pull_at = utc_now()
                detections, payload_source_node, payload_metrics, payload_format = await fetch_stream_payload(
                    stream_url=session.stream_url,
                    timeout_seconds=session.timeout_seconds,
                )

                if not detections:
                    raise ValueError("No detections found in stream payload")

                session.payload_format = payload_format
                session.detections_fetched_total += len(detections)

                if payload_source_node and not session.source_node:
                    session.source_node = payload_source_node

                merged_metrics = dict(payload_metrics)
                merged_metrics.update(session.metrics)

                async with AsyncSessionLocal() as db:
                    ingest_result = await ingest_sms_adapter_batch(
                        SmsAdapterIngestRequest(
                            source_node=session.source_node,
                            detections=detections,
                            metrics=merged_metrics,
                        ),
                        db,
                    )

                session.accepted_total += ingest_result.accepted
                session.rejected_total += ingest_result.rejected
                session.last_success_at = utc_now()
                session.consecutive_failures = 0
                session.last_error = None
                session.status = "running"

                await sms_realtime_hub.publish({
                    "type": "sms_stream_session_tick",
                    "session": session.snapshot(),
                    "accepted": ingest_result.accepted,
                    "rejected": ingest_result.rejected,
                })

                await asyncio.sleep(session.pull_interval_seconds)
            except asyncio.CancelledError:
                break
            except (ValueError, urllib_error.URLError, TimeoutError) as exc:
                session.consecutive_failures += 1
                session.last_error = str(exc)
                session.status = "degraded"

                retry_delay = min(
                    self.retry_max_seconds,
                    max(
                        session.pull_interval_seconds,
                        session.pull_interval_seconds * (2 ** min(session.consecutive_failures, 5)),
                    ),
                )

                await sms_realtime_hub.publish({
                    "type": "sms_stream_session_error",
                    "session": session.snapshot(),
                    "retry_in_seconds": retry_delay,
                })
                await asyncio.sleep(retry_delay)
            except Exception as exc:
                session.consecutive_failures += 1
                session.last_error = str(exc)
                session.status = "degraded"

                retry_delay = min(self.retry_max_seconds, max(session.pull_interval_seconds, 5.0))
                await sms_realtime_hub.publish({
                    "type": "sms_stream_session_error",
                    "session": session.snapshot(),
                    "retry_in_seconds": retry_delay,
                })
                await asyncio.sleep(retry_delay)
