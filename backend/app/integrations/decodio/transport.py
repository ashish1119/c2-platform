import asyncio
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable
from uuid import uuid4

from app.integrations.decodio.codec import DecodioFramer, decode_message, encode_message
from app.logging_config import logger


class DecodioTransport:
    def __init__(
        self,
        host: str,
        port: int,
        connect_timeout: float,
        read_timeout: float,
        heartbeat_interval: int,
        reconnect_max_seconds: int,
        ack_timeout_seconds: float,
        on_message: Callable[[dict[str, Any]], Awaitable[None]],
        on_connected: Callable[[], Awaitable[None]] | None = None,
    ):
        self.host = host
        self.port = port
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.heartbeat_interval = heartbeat_interval
        self.reconnect_max_seconds = reconnect_max_seconds
        self.ack_timeout_seconds = ack_timeout_seconds
        self.on_message = on_message
        self.on_connected = on_connected

        self.state = "DISCONNECTED"
        self.connected = False
        self.reconnect_attempts = 0
        self.last_error: str | None = None
        self.last_message_at: datetime | None = None

        self._stop_event = asyncio.Event()
        self._supervisor_task: asyncio.Task | None = None
        self._reader_task: asyncio.Task | None = None
        self._writer_task: asyncio.Task | None = None
        self._heartbeat_task: asyncio.Task | None = None

        self._writer: asyncio.StreamWriter | None = None
        self._outbound: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=1000)
        self._pending: dict[str, asyncio.Future] = {}

    async def start(self) -> None:
        if self._supervisor_task and not self._supervisor_task.done():
            return
        self._stop_event.clear()
        self._supervisor_task = asyncio.create_task(self._supervise(), name="decodio-supervisor")

    async def stop(self) -> None:
        self._stop_event.set()
        for task in [self._heartbeat_task, self._reader_task, self._writer_task, self._supervisor_task]:
            if task and not task.done():
                task.cancel()
        self._reader_task = None
        self._writer_task = None
        self._heartbeat_task = None
        self._supervisor_task = None

        if self._writer:
            self._writer.close()
            await self._writer.wait_closed()
            self._writer = None

        self.connected = False
        self.state = "DISCONNECTED"

    async def send_command(self, name: str, payload: dict[str, Any]) -> dict[str, Any]:
        request_id = str(uuid4())
        command = {
            "messageType": "command",
            "name": name,
            "requestId": request_id,
            "payload": payload,
        }

        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self._pending[request_id] = future
        await self._outbound.put(command)

        try:
            return await asyncio.wait_for(future, timeout=self.ack_timeout_seconds)
        finally:
            self._pending.pop(request_id, None)

    async def _supervise(self) -> None:
        delay_seconds = 1
        while not self._stop_event.is_set():
            try:
                self.state = "CONNECTING"
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port),
                    timeout=self.connect_timeout,
                )
                self._writer = writer
                self.connected = True
                self.state = "CONNECTED"
                self.last_error = None
                self.reconnect_attempts = 0
                delay_seconds = 1

                framer = DecodioFramer()
                self._reader_task = asyncio.create_task(self._reader_loop(reader, framer), name="decodio-reader")
                self._writer_task = asyncio.create_task(self._writer_loop(writer), name="decodio-writer")
                self._heartbeat_task = asyncio.create_task(self._heartbeat_loop(), name="decodio-heartbeat")

                if self.on_connected:
                    await self.on_connected()

                await asyncio.gather(self._reader_task, self._writer_task, self._heartbeat_task)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.connected = False
                self.state = "DEGRADED"
                self.reconnect_attempts += 1
                self.last_error = str(exc)
                logger.warning(f"Decodio transport degraded: {exc}")
                await asyncio.sleep(min(delay_seconds, self.reconnect_max_seconds))
                delay_seconds = min(delay_seconds * 2, self.reconnect_max_seconds)
            finally:
                self.connected = False
                if self._writer:
                    self._writer.close()
                    await self._writer.wait_closed()
                    self._writer = None

    async def _reader_loop(self, reader: asyncio.StreamReader, framer: DecodioFramer) -> None:
        while not self._stop_event.is_set():
            chunk = await asyncio.wait_for(reader.read(4096), timeout=self.read_timeout)
            if not chunk:
                raise ConnectionError("Decodio socket closed")
            self.last_message_at = datetime.now(timezone.utc)
            for frame in framer.feed(chunk):
                message = decode_message(frame)
                request_id = message.get("requestId")
                if request_id and request_id in self._pending:
                    future = self._pending[request_id]
                    if not future.done():
                        future.set_result(message)
                    continue
                await self.on_message(message)

    async def _writer_loop(self, writer: asyncio.StreamWriter) -> None:
        while not self._stop_event.is_set():
            message = await self._outbound.get()
            writer.write(encode_message(message))
            await writer.drain()

    async def _heartbeat_loop(self) -> None:
        while not self._stop_event.is_set():
            await asyncio.sleep(self.heartbeat_interval)
            if not self.connected:
                continue
            try:
                await self._outbound.put(
                    {
                        "messageType": "command",
                        "name": "ping",
                        "requestId": str(uuid4()),
                        "payload": {},
                    }
                )
            except Exception as exc:
                logger.warning(f"Decodio heartbeat enqueue failed: {exc}")

    def health(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "connected": self.connected,
            "host": self.host,
            "port": self.port,
            "reconnect_attempts": self.reconnect_attempts,
            "last_error": self.last_error,
            "last_message_at": self.last_message_at,
        }
