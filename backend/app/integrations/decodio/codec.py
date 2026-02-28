import json
from typing import Any

DELIMITER = b"\xFE\xFF"


class DecodioFramer:
    def __init__(self):
        self._buffer = bytearray()

    def feed(self, chunk: bytes) -> list[bytes]:
        self._buffer.extend(chunk)
        frames: list[bytes] = []

        while True:
            idx = self._buffer.find(DELIMITER)
            if idx < 0:
                break
            frame = bytes(self._buffer[:idx])
            del self._buffer[: idx + len(DELIMITER)]
            if frame:
                frames.append(frame)

        return frames


def encode_message(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8") + DELIMITER


def decode_message(frame: bytes) -> dict[str, Any]:
    return json.loads(frame.decode("utf-8"))
