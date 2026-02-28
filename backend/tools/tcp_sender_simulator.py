import json
import socket
import time
import uuid
from datetime import datetime, timezone

HOST = "127.0.0.1"
PORT = 9300


def build_message(index: int) -> dict:
    value = 70 + (index % 40)
    severity_hint = None
    if value >= 95:
        severity_hint = "CRITICAL"
    elif value >= 85:
        severity_hint = "HIGH"

    return {
        "msg_id": str(uuid.uuid4()),
        "sender_id": "sim-sender-01",
        "event_type": "temperature",
        "value": float(value),
        "unit": "C",
        "severity_hint": severity_hint,
        "ts": datetime.now(timezone.utc).isoformat(),
        "latitude": 28.567,
        "longitude": 77.321,
    }


def main() -> None:
    with socket.create_connection((HOST, PORT), timeout=5) as sock:
        print(f"Connected to {HOST}:{PORT}")
        for index in range(1, 101):
            payload = build_message(index)
            line = json.dumps(payload, separators=(",", ":")) + "\n"
            sock.sendall(line.encode("utf-8"))
            print(f"sent#{index}: value={payload['value']} severity_hint={payload['severity_hint']}")
            time.sleep(1)


if __name__ == "__main__":
    main()
