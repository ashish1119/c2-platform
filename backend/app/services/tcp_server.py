import asyncio
import json
import socket
import threading
import uuid
from datetime import datetime, timezone

from app.core.websocket_manager import manager
from app.database import AsyncSessionLocal
from app.schemas import RFSignalCreate
from app.services.rf_service import ingest_signal


HOST = "0.0.0.0"
PORT = 5000


def run_async_task(coro) -> None:
    if manager.loop is None:
        return

    asyncio.run_coroutine_threadsafe(coro, manager.loop)


def start_tcp_server() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen(5)

    print(f"TCP Server listening on {HOST}:{PORT}")

    while True:
        conn, addr = server.accept()
        print(f"Connected by {addr}")
        client_thread = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
        client_thread.start()


def handle_client(conn, addr) -> None:
    buffer = ""

    try:
        while True:
            data = conn.recv(1024)
            if not data:
                print(f"Client disconnected: {addr}")
                break

            buffer += data.decode(errors="ignore")

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue

                print(f"Received: {line}")

                try:
                    raw = json.loads(line)
                    detected_at = datetime.now(timezone.utc)
                    enriched_raw = {
                        "id": int(uuid.uuid4().int % 1_000_000),
                        "freq": raw.get("freq"),
                        "power": raw.get("power"),
                        "snr": raw.get("snr", 0),
                        "lat": raw.get("lat", 0),
                        "lon": raw.get("lon", 0),
                        "DOA": raw.get("DOA"),
                        "timestamp": detected_at.isoformat(),
                    }

                    rf_signal = RFSignalCreate(
                        frequency=enriched_raw["freq"],
                        power_level=enriched_raw["power"],
                        confidence=min(max(float(enriched_raw["snr"] or 0) / 30.0, 0.0), 1.0),
                        latitude=enriched_raw["lat"],
                        longitude=enriched_raw["lon"],
                        doa_deg=enriched_raw["DOA"],
                        detected_at=detected_at,
                    )

                    manager.send_from_thread(enriched_raw)
                    manager.send_from_thread(
                        {
                            "type": "sms_ingest",
                            "source_node": "tcp_node_01",
                            "accepted": 1,
                            "rejected": 0,
                            "data": enriched_raw,
                        }
                    )
                    run_async_task(process_message_async(rf_signal))
                except json.JSONDecodeError:
                    print(f"Invalid JSON: {line}")
                except Exception as exc:
                    print(f"Error: {exc}")
    except Exception as exc:
        print(f"Error with {addr}: {exc}")
    finally:
        conn.close()


async def process_message_async(rf_signal: RFSignalCreate) -> None:
    async with AsyncSessionLocal() as db:
        try:
            await ingest_signal(rf_signal, db)
            print("Saved RF signal")
        except Exception as exc:
            print(f"Error processing message: {exc}")