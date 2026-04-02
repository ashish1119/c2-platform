# import socket
# import threading
# import json

# from app.database import SessionLocal
# from app.schemas import RFData
# from app.services.rf_service import save_rf_data
# from app.core.websocket_manager import manager  # ✅ NEW

# HOST = "0.0.0.0"
# PORT = 5000


# def start_tcp_server():
#     server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#     server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

#     server.bind((HOST, PORT))
#     server.listen(5)

#     print(f"🚀 TCP Server listening on {HOST}:{PORT}")

#     while True:
#         conn, addr = server.accept()
#         print(f"✅ Connected by {addr}")

#         client_thread = threading.Thread(
#             target=handle_client,
#             args=(conn, addr),
#             daemon=True
#         )
#         client_thread.start()


# def handle_client(conn, addr):
#     buffer = ""

#     try:
#         while True:
#             data = conn.recv(1024)

#             if not data:
#                 print(f"❌ Client disconnected: {addr}")
#                 break

#             buffer += data.decode(errors="ignore")

#             while "\n" in buffer:
#                 line, buffer = buffer.split("\n", 1)

#                 line = line.strip()
#                 if not line:
#                     continue

#                 print("📩 Received:", line)

#                 process_message(line)

#     except Exception as e:
#         print(f"⚠️ Error with {addr}: {e}")

#     finally:
#         conn.close()


# def process_message(message: str):
#     db = SessionLocal()

#     try:
#         # ✅ Parse JSON safely
#         try:
#             data_dict = json.loads(message)
#         except json.JSONDecodeError:
#             print("❌ Invalid JSON:", message)
#             return

#         # ✅ Validate schema
#         rf_data = RFData(**data_dict)

#         # ✅ Save to DB (make sure duplicate handling is fixed in service)
#         save_rf_data(db, rf_data)

#         print("✅ Saved:", rf_data.id)

#         # 🚀 SEND TO WEBSOCKET CLIENTS (REAL-TIME)
#         try:
#             manager.send_from_thread(data_dict)
#         except Exception as ws_error:
#             print("⚠️ WebSocket error:", ws_error)

#     except Exception as e:
#         print("❌ Error processing message:", e)

#     finally:
#         db.close()



# import socket
# import threading
# import json
# import asyncio
# from datetime import datetime

# from app.database import AsyncSessionLocal
# from app.schemas import RFSignalCreate
# from app.services.rf_service import ingest_signal
# from app.core.websocket_manager import manager

# HOST = "0.0.0.0"
# PORT = 5000


# def start_tcp_server():
#     server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#     server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

#     server.bind((HOST, PORT))
#     server.listen(5)

#     print(f"🚀 TCP Server listening on {HOST}:{PORT}")

#     while True:
#         conn, addr = server.accept()
#         print(f"✅ Connected by {addr}")

#         client_thread = threading.Thread(
#             target=handle_client,
#             args=(conn, addr),
#             daemon=True
#         )
#         client_thread.start()


# def handle_client(conn, addr):
#     buffer = ""

#     try:
#         while True:
#             data = conn.recv(1024)

#             if not data:
#                 print(f"❌ Client disconnected: {addr}")
#                 break

#             buffer += data.decode(errors="ignore")

#             while "\n" in buffer:
#                 line, buffer = buffer.split("\n", 1)

#                 line = line.strip()
#                 if not line:
#                     continue

#                 print("📩 Received:", line)

#                 try:
#                     raw = json.loads(line)

#                     # 🔥 MAP incoming → backend schema
#                     mapped_data = {
#                         "frequency": raw.get("freq"),
#                         "power_level": raw.get("power"),
#                         "confidence": raw.get("snr", 0),
#                         "latitude": raw.get("lat", 0),
#                         "longitude": raw.get("lon", 0),
#                         "doa_deg": raw.get("DOA"),
#                         "detected_at": datetime.utcnow().isoformat()
#                     }

#                     # ✅ Send ORIGINAL data to frontend (for UI)
#                     manager.send_from_thread(raw)

#                     # ✅ Save mapped data to DB
#                     asyncio.run(process_message_async(mapped_data))

#                 except Exception as e:
#                     print("❌ Error:", e)

#     except Exception as e:
#         print(f"⚠️ Error with {addr}: {e}")

#     finally:
#         conn.close()


# async def process_message_async(data_dict: dict):
#     async with AsyncSessionLocal() as db:
#         try:
#             # ✅ Validate schema
#             rf_data = RFSignalCreate(**data_dict)

#             # ✅ Save to DB
#             await ingest_signal(rf_data, db)

#             print("✅ Saved")

#         except Exception as e:
#             print("❌ Error processing message:", e)



# import socket
# import threading
# import json
# import asyncio
# from datetime import datetime

# from app.database import AsyncSessionLocal
# from app.schemas import RFSignalCreate
# from app.services.rf_service import ingest_signal
# from app.core.websocket_manager import manager

# HOST = "0.0.0.0"
# PORT = 5000


# # ✅ helper to safely run async tasks from threads
# def run_async_task(coro):
#     try:
#         loop = asyncio.get_event_loop()
#     except RuntimeError:
#         loop = asyncio.new_event_loop()
#         asyncio.set_event_loop(loop)

#     loop.create_task(coro)


# def start_tcp_server():
#     server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#     server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

#     server.bind((HOST, PORT))
#     server.listen(5)

#     print(f"🚀 TCP Server listening on {HOST}:{PORT}")

#     while True:
#         conn, addr = server.accept()
#         print(f"✅ Connected by {addr}")

#         client_thread = threading.Thread(
#             target=handle_client,
#             args=(conn, addr),
#             daemon=True
#         )
#         client_thread.start()


# def handle_client(conn, addr):
#     buffer = ""

#     try:
#         while True:
#             data = conn.recv(1024)

#             if not data:
#                 print(f"❌ Client disconnected: {addr}")
#                 break

#             buffer += data.decode(errors="ignore")

#             while "\n" in buffer:
#                 line, buffer = buffer.split("\n", 1)

#                 line = line.strip()
#                 if not line:
#                     continue

#                 print("📩 Received:", line)

#                 try:
#                     raw = json.loads(line)

#                     # 🔥 MAP incoming → backend schema
#                     mapped_data = {
#                         "frequency": raw.get("freq"),
#                         "power_level": raw.get("power"),
#                         "confidence": min(raw.get("snr", 0) / 30, 1),  # FIXED
#                         "latitude": raw.get("lat", 0),
#                         "longitude": raw.get("lon", 0),
#                         "doa_deg": raw.get("DOA"),
#                         "detected_at": datetime.utcnow().isoformat()
#                     }

#                     # ✅ Send ORIGINAL data to frontend (for UI)
#                     manager.send_from_thread(raw)

#                     # ✅ Async DB save (FIXED - no asyncio.run)
#                     run_async_task(process_message_async(mapped_data))

#                 except Exception as e:
#                     print("❌ Error:", e)

#     except Exception as e:
#         print(f"⚠️ Error with {addr}: {e}")

#     finally:
#         conn.close()


# async def process_message_async(data_dict: dict):
#     async with AsyncSessionLocal() as db:
#         try:
#             rf_data = RFSignalCreate(**data_dict)
#             await ingest_signal(rf_data, db)
#             print("✅ Saved")

#         except Exception as e:
#             print("❌ Error processing message:", e)


# import socket
# import threading
# import json
# import asyncio
# from datetime import datetime
# import uuid

# from app.database import AsyncSessionLocal
# from app.schemas import RFSignalCreate
# from app.services.rf_service import ingest_signal
# from app.core.websocket_manager import manager

# HOST = "0.0.0.0"
# PORT = 5000

# # main_loop = None


# # ✅ helper to safely run async tasks from threads
# # def run_async_task(coro):
# #     try:
# #         loop = asyncio.get_event_loop()
# #     except RuntimeError:
# #         loop = asyncio.new_event_loop()
# #         asyncio.set_event_loop(loop)

# #     loop.create_task(coro)

# # def run_async_task(coro):
# #     global main_loop

# #     if main_loop and main_loop.is_running():
# #         asyncio.run_coroutine_threadsafe(coro, main_loop)
# #     else:
# #         print("❌ Event loop not running")

# def run_async_task(coro):
#     loop = manager.loop   # ✅ use existing loop

#     if loop and loop.is_running():
#         asyncio.run_coroutine_threadsafe(coro, loop)
#     else:
#         print("❌ Event loop not available")


# def start_tcp_server():
#     global main_loop
#     # main_loop = asyncio.get_event_loop()

#     server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#     server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

#     server.bind((HOST, PORT))
#     server.listen(5)

#     print(f"🚀 TCP Server listening on {HOST}:{PORT}")

#     while True:
#         conn, addr = server.accept()
#         print(f"✅ Connected by {addr}")

#         client_thread = threading.Thread(
#             target=handle_client,
#             args=(conn, addr),
#             daemon=True
#         )
#         client_thread.start()


# def handle_client(conn, addr):
#     buffer = ""

#     try:
#         while True:
#             data = conn.recv(1024)

#             if not data:
#                 print(f"❌ Client disconnected: {addr}")
#                 break

#             buffer += data.decode(errors="ignore")

#             while "\n" in buffer:
#                 line, buffer = buffer.split("\n", 1)

#                 line = line.strip()
#                 if not line:
#                     continue

#                 print("📩 Received:", line)

#                 try:
#                     raw = json.loads(line)

#                     # ✅ ADD ID + TIMESTAMP (IMPORTANT FOR UI)
#                     enriched_raw = {
#                         "id": int(uuid.uuid4().int % 1000000),
#                         "system_id": raw.get("system_id"),
#                         "freq": raw.get("freq"),
#                         "power": raw.get("power"),
#                         "snr": raw.get("snr", 0),
#                         "lat": raw.get("lat", 0),
#                         "lon": raw.get("lon", 0),
#                         "DOA": raw.get("doa"),
#                         "timestamp": datetime.utcnow().isoformat()
#                     }

#                     # 🔥 MAP incoming → backend DB schema
#                     mapped_data = {
#                         "frequency": enriched_raw["freq"],
#                         "power_level": enriched_raw["power"],
#                         "confidence": min(enriched_raw["snr"] / 30, 1),
#                         "latitude": enriched_raw["lat"],
#                         "longitude": enriched_raw["lon"],
#                         "doa_deg": enriched_raw["DOA"],
#                         "detected_at": enriched_raw["timestamp"]
#                     }

#                     # ================================
#                     # ✅ 1. SEND RAW → CESM TABLE
#                     # ================================
#                     manager.send_from_thread(enriched_raw)

#                     # ================================
#                     # ✅ 2. SEND SMS FORMAT → DASHBOARD
#                     # ================================
#                     manager.send_from_thread({
#                         "type": "sms_ingest",
#                         "source_node": "tcp_node_01",
#                         "accepted": 1,
#                         "rejected": 0,
#                         "data": enriched_raw
#                     })

#                     # ================================
#                     # ✅ 3. SAVE TO DATABASE (ASYNC)
#                     # ================================
#                     run_async_task(process_message_async(mapped_data))

#                 except json.JSONDecodeError:
#                     print("❌ Invalid JSON:", line)

#                 except Exception as e:
#                     print("❌ Error:", e)

#     except Exception as e:
#         print(f"⚠️ Error with {addr}: {e}")

#     finally:
#         conn.close()


# async def process_message_async(data_dict: dict):
#     try:
#         async with AsyncSessionLocal() as db:
#             rf_data = RFSignalCreate(**data_dict)
#             await ingest_signal(rf_data, db)
#             print("✅ Saved")

#     except Exception as e:
#             print("❌ Error processing message:", e)



# import socket
# import threading
# import json
# import asyncio
# import time
# from datetime import datetime
# import uuid

# from app.database import AsyncSessionLocal
# from app.schemas import RFSignalCreate
# from app.services.rf_service import ingest_signal
# from app.core.websocket_manager import manager

# HOST = "0.0.0.0"
# PORT = 5000

# # 🔥 CONTROL FLAG (VERY IMPORTANT)
# STORE_IN_DB = 0   # 👉 1 = store in DB, 0 = only websocket

# # 🔥 QUEUE FOR DB (fix deadlock)
# db_queue = asyncio.Queue()


# # ================================
# # ✅ SAFE ASYNC TASK RUNNER
# # ================================
# def run_async_task(coro):
#     loop = manager.loop

#     if loop and loop.is_running():
#         asyncio.run_coroutine_threadsafe(coro, loop)
#     else:
#         print("❌ Event loop not available")


# # ================================
# # ✅ DB WORKER (ONLY ONE WRITER)
# # ================================
# async def db_worker():
#     print("🚀 DB Worker Started")

#     while True:
#         data_dict = await db_queue.get()

#         try:
#             async with AsyncSessionLocal() as db:
#                 rf_data = RFSignalCreate(**data_dict)
#                 await ingest_signal(rf_data, db)
#                 print("✅ Saved")

#         except Exception as e:
#             print("❌ DB Error:", e)

#         db_queue.task_done()


# # ================================
# # ✅ TCP SERVER
# # ================================
# def start_tcp_server():
#     server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#     server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

#     server.bind((HOST, PORT))
#     server.listen(5)

#     print(f"🚀 TCP Server listening on {HOST}:{PORT}")

#     while True:
#         conn, addr = server.accept()
#         print(f"✅ Connected by {addr}")

#         threading.Thread(
#             target=handle_client,
#             args=(conn, addr),
#             daemon=True
#         ).start()


# # ================================
# # ✅ HANDLE CLIENT
# # ================================
# def handle_client(conn, addr):
#     buffer = ""
#     last_ws_sent = 0

#     try:
#         while True:
#             data = conn.recv(1024)

#             if not data:
#                 print(f"❌ Client disconnected: {addr}")
#                 break

#             buffer += data.decode(errors="ignore")

#             while "\n" in buffer:
#                 line, buffer = buffer.split("\n", 1)
#                 line = line.strip()

#                 if not line:
#                     continue

#                 print("📩 Received:", line)

#                 try:
#                     raw = json.loads(line)

#                     # ✅ ENRICH
#                     enriched_raw = {
#                         "id": int(uuid.uuid4().int % 1000000),
#                         "system_id": raw.get("system_id"),
#                         "freq": raw.get("freq"),
#                         "power": raw.get("power"),
#                         "snr": raw.get("snr", 0),
#                         "lat": raw.get("lat", 0),
#                         "lon": raw.get("lon", 0),
#                         "DOA": raw.get("doa"),
#                         "timestamp": datetime.utcnow().isoformat()
#                     }

#                     # ✅ MAP FOR DB
#                     mapped_data = {
#                         "frequency": enriched_raw["freq"],
#                         "power_level": enriched_raw["power"],
#                         "confidence": min(enriched_raw["snr"] / 30, 1),
#                         "latitude": enriched_raw["lat"],
#                         "longitude": enriched_raw["lon"],
#                         "doa_deg": enriched_raw["DOA"],
#                         "detected_at": enriched_raw["timestamp"]
#                     }

#                     # ================================
#                     # 🔥 WEBSOCKET (THROTTLED)
#                     # ================================
#                     if time.time() - last_ws_sent > 0.1:
#                         manager.send_from_thread(enriched_raw)
#                         last_ws_sent = time.time()

#                     # ================================
#                     # 🔥 DB CONTROL (FLAG BASED)
#                     # ================================
#                     if STORE_IN_DB == 1:
#                         run_async_task(db_queue.put(mapped_data))

#                 except Exception as e:
#                     print("❌ Error:", e)

#     except Exception as e:
#         print(f"⚠️ Error with {addr}: {e}")

#     finally:
#         conn.close()


import socket
import threading
import json
import asyncio
from datetime import datetime
import uuid

from app.database import AsyncSessionLocal
from app.schemas import RFSignalCreate
from app.services.rf_service import ingest_signal
from app.core.websocket_manager import manager

HOST = "0.0.0.0"
PORT = 5000


# ✅ helper to safely run async tasks from threads
def run_async_task(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    loop.create_task(coro)


def start_tcp_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    server.bind((HOST, PORT))
    server.listen(5)

    print(f"🚀 TCP Server listening on {HOST}:{PORT}")

    while True:
        conn, addr = server.accept()
        print(f"✅ Connected by {addr}")

        client_thread = threading.Thread(
            target=handle_client,
            args=(conn, addr),
            daemon=True
        )
        client_thread.start()

def normalize_frequency(freq):
    return round(freq, 1) 

def handle_client(conn, addr):
    buffer = ""

    try:
        while True:
            data = conn.recv(1024)

            if not data:
                print(f"❌ Client disconnected: {addr}")
                break

            buffer += data.decode(errors="ignore")

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)

                line = line.strip()
                if not line:
                    continue

                print("📩 Received:", line)

                try:
                    raw = json.loads(line)

                    # ✅ ADD ID + TIMESTAMP (IMPORTANT FOR UI)
                    enriched_raw = {
                        "id": int(uuid.uuid4().int % 1000000),
                        "system_id": raw.get("system_id"),
                        "freq": normalize_frequency(raw.get("freq")),
                        "power": raw.get("power"),
                        "snr": raw.get("snr", 0),
                        "lat": raw.get("lat", 0),
                        "lon": raw.get("lon", 0),
                        "DOA": raw.get("doa"),
                        "timestamp": datetime.utcnow().isoformat()
                    }

                    # 🔥 MAP incoming → backend DB schema
                    # mapped_data = {
                    #     "frequency": enriched_raw["freq"],
                    #     "power_level": enriched_raw["power"],
                    #     "confidence": min(enriched_raw["snr"] / 30, 1),
                    #     "latitude": enriched_raw["lat"],
                    #     "longitude": enriched_raw["lon"],
                    #     "doa_deg": enriched_raw["DOA"],
                    #     "detected_at": enriched_raw["timestamp"]
                    # }

                    # ================================
                    # ✅ 1. SEND RAW → CESM TABLE
                    # ================================
                    manager.send_from_thread(enriched_raw)

                    # ================================
                    # ✅ 2. SEND SMS FORMAT → DASHBOARD
                    # ================================
                    manager.send_from_thread({
                        "type": "sms_ingest",
                        "source_node": "tcp_node_01",
                        "accepted": 1,
                        "rejected": 0,
                        "data": enriched_raw
                    })

                    # ================================
                    # ✅ 3. SAVE TO DATABASE (ASYNC)
                    # ================================
                    # run_async_task(process_message_async(mapped_data))

                except json.JSONDecodeError:
                    print("❌ Invalid JSON:", line)

                except Exception as e:
                    print("❌ Error:", e)

    except Exception as e:
        print(f"⚠️ Error with {addr}: {e}")

    finally:
        conn.close()


async def process_message_async(data_dict: dict):
    async with AsyncSessionLocal() as db:
        try:
            rf_data = RFSignalCreate(**data_dict)
            await ingest_signal(rf_data, db)
            print("✅ Saved")

        except Exception as e:
            print("❌ Error processing message:", e)