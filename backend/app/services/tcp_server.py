import socket
import threading
import json
import asyncio
from datetime import datetime
from collections import defaultdict

from app.database import AsyncSessionLocal
from app.schemas import RFSignalCreate
from app.services.rf_service import ingest_signal, triangulate_signals
from app.core.websocket_manager import manager

HOST = "0.0.0.0"
PORT = 5000

signal_buffer = defaultdict(list)

FREQ_TOLERANCE = 1.0


# ===============================
# Async helper
# ===============================
def run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    loop.create_task(coro)


# ===============================
# TCP SERVER
# ===============================
def start_tcp_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    server.bind((HOST, PORT))
    server.listen(10)

    print(f"🚀 TCP Server running on {HOST}:{PORT}", flush=True)

    while True:
        conn, addr = server.accept()
        print(f"✅ Connected: {addr}", flush=True)

        threading.Thread(
            target=handle_client,
            args=(conn, addr),
            daemon=True
        ).start()


# ===============================
# CLIENT HANDLER
# ===============================
def handle_client(conn, addr):
    buffer = ""

    try:
        while True:
            data = conn.recv(2048)
            if not data:
                break

            buffer += data.decode(errors="ignore")

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()

                if not line:
                    continue

                try:
                    print(f"📩 RAW: {line}", flush=True)

                    raw = json.loads(line)

                    # =========================
                    # 🔥 Extract DF data
                    # =========================
                    system_id = raw.get("system_id", "UNKNOWN")

                    freq = raw.get("freq")
                    power = raw.get("power")
                    snr = raw.get("snr")
                    doa = raw.get("doa")
                    lat = raw.get("lat")
                    lon = raw.get("lon")
                    timestamp = raw.get("timestamp")

                    confidence = min((snr or 0) / 30, 1)

                    # =========================
                    # 🔥 FULL DEBUG PRINT
                    # =========================
                    print(
                        f"""
📡 DF SYSTEM [{system_id}]
----------------------------------------
Frequency     : {freq} MHz
Power         : {power} dBm
SNR           : {snr}
Confidence    : {confidence:.2f}
DOA           : {doa}°
Latitude      : {lat}
Longitude     : {lon}
Timestamp     : {timestamp}
----------------------------------------
""",
                        flush=True
                    )

                    # =========================
                    # 🔥 Enriched signal
                    # =========================
                    enriched = {
                        "system_id": system_id,
                        "id": raw.get("id"),
                        "freq": freq,
                        "power": power,
                        "snr": snr,
                        "doa": doa,
                        "lat": lat,
                        "lon": lon,
                        "timestamp": timestamp
                    }

                    # =========================
                    # 🔥 Send raw to frontend
                    # =========================
                    manager.send_from_thread({
                        "type": "rf_signal",
                        "data": enriched
                    })

                    # =========================
                    # 🔥 Group by frequency
                    # =========================
                    bucket = round(freq / FREQ_TOLERANCE) * FREQ_TOLERANCE
                    signal_buffer[bucket].append(enriched)

                    print(
                        f"🧠 Buffer[{bucket}] = {len(signal_buffer[bucket])} signals "
                        f"(last from DF {system_id})",
                        flush=True
                    )

                    # =========================
                    # 🔥 Async processing
                    # =========================
                    run_async(process_signal(enriched, bucket))

                except Exception as e:
                    print("❌ Error:", e, flush=True)

    finally:
        conn.close()
        print(f"❌ Disconnected: {addr}", flush=True)


# ===============================
# CORE PROCESSING
# ===============================
async def process_signal(signal, bucket):
    async with AsyncSessionLocal() as db:
        try:
            # =====================
            # 1. SAVE TO DB
            # =====================
            rf = RFSignalCreate(
                frequency=signal["freq"],
                power_level=signal["power"],
                confidence=min(signal["snr"] / 30, 1),
                latitude=signal["lat"],
                longitude=signal["lon"],
                doa_deg=signal["doa"],
                detected_at=signal["timestamp"]
            )

            await ingest_signal(rf, db)

            # =====================
            # 2. TRIANGULATION
            # =====================
            group = signal_buffer[bucket]

            unique_systems = set(s["system_id"] for s in group)

            if len(unique_systems) >= 3:
                print(f"🎯 TRIANGULATION TRIGGERED for freq={bucket}", flush=True)

                result = await triangulate_signals(db)

                await manager.broadcast({
                    "type": "triangulation",
                    "frequency": bucket,
                    "data": result
                })

                signal_buffer[bucket] = []

            # =====================
            # 3. SPECTRUM
            # =====================
            await manager.broadcast({
                "type": "spectrum",
                "data": {
                    "frequency": signal["freq"],
                    "power": signal["power"]
                }
            })

            # =====================
            # 4. SPECTROGRAM
            # =====================
            await manager.broadcast({
                "type": "spectrogram",
                "data": {
                    "frequency": signal["freq"],
                    "power": signal["power"],
                    "timestamp": signal["timestamp"]
                }
            })

        except Exception as e:
            print("❌ Async error:", e, flush=True)