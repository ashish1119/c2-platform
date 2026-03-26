import socket
import threading
import json

from app.database import SessionLocal
from app.schemas import RFData
from app.services.rf_service import save_rf_data
from app.core.websocket_manager import manager  # ✅ NEW

HOST = "0.0.0.0"
PORT = 5000


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

                process_message(line)

    except Exception as e:
        print(f"⚠️ Error with {addr}: {e}")

    finally:
        conn.close()


def process_message(message: str):
    db = SessionLocal()

    try:
        # ✅ Parse JSON safely
        try:
            data_dict = json.loads(message)
        except json.JSONDecodeError:
            print("❌ Invalid JSON:", message)
            return

        # ✅ Validate schema
        rf_data = RFData(**data_dict)

        # ✅ Save to DB (make sure duplicate handling is fixed in service)
        save_rf_data(db, rf_data)

        print("✅ Saved:", rf_data.id)

        # 🚀 SEND TO WEBSOCKET CLIENTS (REAL-TIME)
        try:
            manager.send_from_thread(data_dict)
        except Exception as ws_error:
            print("⚠️ WebSocket error:", ws_error)

    except Exception as e:
        print("❌ Error processing message:", e)

    finally:
        db.close()