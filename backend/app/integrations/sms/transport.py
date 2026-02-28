import asyncio
from datetime import datetime
from typing import Any, Awaitable, Callable


class SmsAdapterTransport:
    def __init__(
        self,
        on_message: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
        queue_maxsize: int = 1000,
    ):
        self.on_message = on_message
        self._queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=queue_maxsize)
        self._task: asyncio.Task | None = None
        self._running = False
        self.last_message_at: datetime | None = None

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._drain_loop(), name="sms-adapter-transport")

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    async def publish(self, message: dict[str, Any]) -> None:
        await self._queue.put(message)

    def queue_depth(self) -> int:
        return self._queue.qsize()

    def is_running(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    async def _drain_loop(self) -> None:
        while self._running:
            message = await self._queue.get()
            self.last_message_at = datetime.utcnow()
            if self.on_message is not None:
                await self.on_message(message)
