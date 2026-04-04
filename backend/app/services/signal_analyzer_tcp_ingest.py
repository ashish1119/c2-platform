import json
import socket
import struct
import threading
import time
from typing import Any

from app.core.signal_stream_hub import signal_stream_hub


HOST = "0.0.0.0"
PORT = 9999

SAMPLE_COUNT_DEFAULT = 1024
FLOAT32_BYTES = 4


def _recv_exact(conn: socket.socket, n: int) -> bytes:
    chunks: list[bytes] = []
    remaining = n
    while remaining > 0:
        chunk = conn.recv(remaining)
        if not chunk:
            raise ConnectionError("client disconnected")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _handle_client(conn: socket.socket, addr: tuple[str, int]) -> None:
    conn.settimeout(15)
    try:
        while True:
            length_bytes = _recv_exact(conn, 4)
            (meta_len,) = struct.unpack(">I", length_bytes)
            if meta_len <= 0 or meta_len > 1024 * 1024:
                raise ValueError(f"Invalid metadata length: {meta_len}")

            meta_bytes = _recv_exact(conn, meta_len)
            meta_json = meta_bytes.decode("utf-8", errors="strict")
            meta = json.loads(meta_json)
            if not isinstance(meta, dict):
                raise ValueError("Metadata must be a JSON object")

            chunk_size = int(meta.get("chunk_size") or SAMPLE_COUNT_DEFAULT)
            if chunk_size <= 0 or chunk_size > 2_000_000:
                raise ValueError(f"Invalid chunk_size: {chunk_size}")

            signal_bytes = _recv_exact(conn, chunk_size * FLOAT32_BYTES)

            # Convert float32 little-endian bytes to list[float] for JSON transport.
            # (Python numpy `.tobytes()` defaults to native endian; on x86 that's little.)
            fmt = f"<{chunk_size}f"
            samples = list(struct.unpack(fmt, signal_bytes))

            payload: dict[str, Any] = {
                "type": "stream_data",
                "metadata": meta,
                "signalData": samples,
                "received_at": time.time(),
            }
            signal_stream_hub.send_from_thread(payload)
    except Exception:
        # swallow per-connection errors; client can reconnect
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


def start_signal_analyzer_tcp_server() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen(5)
    print(f"🚀 Signal Analyzer TCP ingest listening on {HOST}:{PORT}")

    while True:
        conn, addr = server.accept()
        t = threading.Thread(target=_handle_client, args=(conn, addr), daemon=True)
        t.start()

