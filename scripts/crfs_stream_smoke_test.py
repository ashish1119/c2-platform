from __future__ import annotations

import argparse
import importlib
import random
import socket
import sys
import time
from pathlib import Path


def _load_proto_module():
    repo_root = Path(__file__).resolve().parents[1]
    backend_path = repo_root / "backend"
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))

    try:
        pbd2_pb2 = importlib.import_module("app.integrations.crfs.generated.pbd2_pb2")
    except Exception as exc:
        print("Unable to import generated pbd2 classes.")
        print("Run: python backend/tools/compile_pbd2.py")
        print(f"Import error: {exc}")
        raise SystemExit(1)

    return pbd2_pb2


def _add_double(data_collection, name: str, key: int, value: float):
    element = data_collection.Elements.add()
    element.Name = name
    element.Key = key
    element.DoubleData.Values.append(float(value))


def _add_string(data_collection, name: str, key: int, value: str):
    element = data_collection.Elements.add()
    element.Name = name
    element.Key = key
    element.StringData.Values.append(value)


def _build_message(pbd2_pb2, index: int):
    now = time.time()

    message = pbd2_pb2.DataGeneric()
    message.DataVersion = 1
    message.Name = "CRFS_SMOKE_TEST"
    message.UnixTime = now

    message.StreamID.GuidString = "STREAM_SMOKE_MAIN"
    message.StreamID.Name = "Smoke Stream"
    message.StreamID.ColorARGB = 4278255360

    message.OriginID.GuidString = f"ORIGIN_SMOKE_{index % 3}"
    message.OriginID.Name = f"Smoke Node {index % 3}"

    latitude = 12.9716 + random.uniform(-0.02, 0.02)
    longitude = 77.5946 + random.uniform(-0.02, 0.02)
    altitude = random.uniform(880.0, 940.0)
    speed = random.uniform(0.0, 25.0)

    center_frequency = 88_000_000 + random.uniform(-40_000, 40_000)
    bandwidth = random.uniform(12_500.0, 50_000.0)
    power = random.uniform(-58.0, -30.0)
    snr = random.uniform(10.0, 45.0)

    aoa_bearing = random.uniform(0.0, 359.9)
    aoa_elevation = random.uniform(1.0, 40.0)

    _add_double(message.Data, "Location_Latitude", 93, latitude)
    _add_double(message.Data, "Location_Longitude", 94, longitude)
    _add_double(message.Data, "Location_Altitude", 90, altitude)
    _add_double(message.Data, "Location_Speed", 92, speed)

    _add_double(message.Data, "Signal_Center", 734, center_frequency)
    _add_double(message.Data, "Signal_Bandwidth", 733, bandwidth)
    _add_double(message.Data, "Signal_Power", 731, power)
    _add_double(message.Data, "Signal_SNR", 730, snr)

    _add_double(message.Data, "AOA_Bearing", 110, aoa_bearing)
    _add_double(message.Data, "AOA_Elevation", 118, aoa_elevation)

    event_type = 100 if index % 5 == 0 else 102
    _add_double(message.Data, "Event_Type", 600, event_type)
    _add_double(message.Data, "Event_Frequency_Center", 610, center_frequency)
    _add_double(message.Data, "Event_Frequency_Span", 611, bandwidth)
    _add_double(message.Data, "Event_Power", 612, power)

    classification = "FM" if index % 2 == 0 else "UNKNOWN"
    _add_string(message.Data, "Data_Classification", 426, classification)

    return message


def main() -> int:
    parser = argparse.ArgumentParser(description="CRFS pbd2 TCP stream smoke sender")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9400)
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--interval", type=float, default=0.4)
    parser.add_argument("--endian", choices=["big", "little"], default="big")
    args = parser.parse_args()

    pbd2_pb2 = _load_proto_module()

    with socket.create_connection((args.host, args.port), timeout=10) as sock:
        for i in range(args.count):
            message = _build_message(pbd2_pb2, i)
            payload = message.SerializeToString()
            frame_len = len(payload).to_bytes(4, byteorder=args.endian, signed=False)
            sock.sendall(frame_len + payload)
            print(f"sent[{i + 1}/{args.count}] bytes={len(payload)}")
            time.sleep(max(0.0, args.interval))

    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
