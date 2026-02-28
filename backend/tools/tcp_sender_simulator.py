import json
import socket
import time
import uuid
import argparse
from datetime import datetime, timezone

HOST = "127.0.0.1"
PORT = 9300


def build_temperature_message(index: int, sender_id: str, source_name: str, source_type: str, source_platform: str, source_operator: str) -> dict:
    value = 70 + (index % 40)
    severity_hint = None
    if value >= 95:
        severity_hint = "CRITICAL"
    elif value >= 85:
        severity_hint = "HIGH"

    return {
        "msg_id": str(uuid.uuid4()),
        "sender_id": sender_id,
        "source_name": source_name,
        "source_type": source_type,
        "source_details": {
            "platform": source_platform,
            "operator": source_operator,
        },
        "event_type": "temperature",
        "value": float(value),
        "unit": "C",
        "severity_hint": severity_hint,
        "ts": datetime.now(timezone.utc).isoformat(),
        "latitude": 28.567,
        "longitude": 77.321,
    }


def build_df_message(index: int, sender_id: str, source_name: str, source_type: str, source_platform: str, source_operator: str) -> dict:
    bearing = float((35 + (index * 7)) % 360)
    severity_hint = "HIGH" if bearing >= 300 else "MEDIUM"
    return {
        "msg_id": str(uuid.uuid4()),
        "sender_id": sender_id,
        "source_name": source_name,
        "source_type": source_type,
        "source_details": {
            "platform": source_platform,
            "operator": source_operator,
        },
        "event_type": "df",
        "value": bearing,
        "unit": "deg",
        "severity_hint": severity_hint,
        "ts": datetime.now(timezone.utc).isoformat(),
        "latitude": 28.567 + (index * 0.0005),
        "longitude": 77.321 + (index * 0.0005),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send NDJSON messages to TCP listener")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--event-type", choices=["temperature", "df"], default="temperature")
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--interval", type=float, default=1.0)
    parser.add_argument("--sender-id", default="sim-sender-01")
    parser.add_argument("--source-name", default="Sim_Source_01")
    parser.add_argument("--source-type", default="SIMULATOR")
    parser.add_argument("--source-platform", default="GROUND")
    parser.add_argument("--source-operator", default="TEST_OP")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with socket.create_connection((args.host, args.port), timeout=5) as sock:
        print(f"Connected to {args.host}:{args.port}")
        for index in range(1, args.count + 1):
            if args.event_type == "df":
                payload = build_df_message(
                    index,
                    args.sender_id,
                    args.source_name,
                    args.source_type,
                    args.source_platform,
                    args.source_operator,
                )
            else:
                payload = build_temperature_message(
                    index,
                    args.sender_id,
                    args.source_name,
                    args.source_type,
                    args.source_platform,
                    args.source_operator,
                )
            line = json.dumps(payload, separators=(",", ":")) + "\n"
            sock.sendall(line.encode("utf-8"))
            print(
                f"sent#{index}: event_type={payload['event_type']} "
                f"value={payload['value']} severity_hint={payload['severity_hint']}"
            )
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
