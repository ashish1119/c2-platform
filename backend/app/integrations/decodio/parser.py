import json
import re
import socket
import time
from typing import Any, Dict, Optional, List


DECODIO_FIELDS = [
    "DeviceId",
    "Alias",
    "StreamId",
    "Protocol",
    "Power",
    "Status",
    "Running",
    "Disabled",
    "Lock",
    "ModeId",
    "SR",
    "Reason",
    "Label",
    "Position",
    "Time",
    "UUID",
    "Version",
    "Command",
    "Color",
    "Notes",
]


def normalize_value(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, str):
        value = value.strip()

        if value.lower() in ("none", "null", ""):
            return None

        if value.lower() == "true":
            return True

        if value.lower() == "false":
            return False

        if value.endswith(" dBm"):
            power_value = value.replace(" dBm", "").strip()
            try:
                return float(power_value)
            except ValueError:
                return value

        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            return value

    return value


def normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    normalized = {}
    for field in DECODIO_FIELDS:
        normalized[field] = normalize_value(record.get(field))
    return normalized


def clean_json_content(content: str) -> str:
    """
    Remove trailing commas before } or ] so malformed JSON like:
    [
      {...},
    ]
    can still be parsed.
    """
    return re.sub(r",\s*([\]}])", r"\1", content.strip())


def parse_decodio_message(msg: str) -> Dict[str, Any]:
    """Parse a single Decodio JSON message."""
    try:
        data = json.loads(msg)
    except json.JSONDecodeError as e:
        return {"error": f"JSON decode error: {e}", "raw_message": msg}

    parsed = {
        "DeviceId": data.get("DeviceId"),
        "Alias": data.get("Alias"),
        "StreamId": data.get("StreamId"),
        "Protocol": data.get("Protocol"),
        "Power": data.get("Power"),
        "Status": data.get("Status"),
        "Running": data.get("Running"),
        "Disabled": data.get("Disabled"),
        "Lock": data.get("Lock"),
        "ModeId": data.get("ModeId"),
        "SR": data.get("SR"),
        "Reason": data.get("Reason"),
        "Label": data.get("Label"),
        "Position": data.get("Position"),
        "Time": data.get("Time"),
        "UUID": data.get("UUID"),
        "Version": data.get("Version"),
        "Command": data.get("Command"),
        "Color": data.get("Color"),
        "Notes": data.get("Notes"),
        "raw_message": msg,
        "parsed_at": time.time(),
    }

    return normalize_record(parsed)


class DecodioDataParser:
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,  
        file_path: Optional[str] = None
    ):
        self.host = host
        self.port = port
        self.file_path = file_path
        self.buffer = ""
        self.sock: Optional[socket.socket] = None
        self.output_file = "decodio_recv_data.txt"

    def connect_tcp(self) -> bool:
        """Connect to TCP server."""
        if not self.host or not self.port:
            return False

        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(5)
            self.sock.connect((self.host, self.port))
            return True
        except Exception as e:
            print(f"TCP connection failed: {e}")
            return False

    def read_from_tcp(self) -> Optional[List[Dict[str, Any]]]:
        """Read TCP stream and parse JSON messages."""
        if not self.sock:
            return None

        try:
            data = self.sock.recv(4096)

            if not data:
                return None

            self.buffer += data.decode("utf-8", errors="ignore")
            messages = []

            while "}{" in self.buffer:
                left, right = self.buffer.split("}{", 1)
                messages.append(left + "}")
                self.buffer = "{" + right

            if self.buffer.endswith("}"):
                messages.append(self.buffer)
                self.buffer = ""

            parsed_messages = []

            for msg in messages:
                parsed = parse_decodio_message(msg)
                if parsed:
                    parsed_messages.append(parsed)
                    self.save_to_file(parsed)

            return parsed_messages if parsed_messages else None

        except Exception as e:
            print(f"TCP read error: {e}")
            return None

    def read_from_file(self) -> Optional[List[Dict[str, Any]]]:
        """Fallback file reader."""
        if not self.file_path:
            return None

        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read()

            parsed_messages = parse_decodio_log_file(content)

            for parsed in parsed_messages:
                self.save_to_file(parsed)

            return parsed_messages if parsed_messages else None

        except FileNotFoundError:
            print(f"File not found: {self.file_path}")
            return None
        except Exception as e:
            print(f"File read error: {e}")
            return None

    def save_to_file(self, parsed_data: Dict[str, Any]) -> None:
        """Save parsed message."""
        try:
            with open(self.output_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(parsed_data) + "\n")
        except Exception as e:
            print(f"Error saving to file: {e}")

    def parse_data(self, timeout: float = 5.0) -> Optional[List[Dict[str, Any]]]:
        """Main parser."""
        if self.connect_tcp():
            print("Connected to Decodio TCP server")
            start = time.time()

            while time.time() - start < timeout:
                data = self.read_from_tcp()
                if data:
                    return data
                time.sleep(0.1)

            print("TCP timeout, switching to file mode")
            return self.read_from_file()
        else:
            print("TCP unavailable, using file mode")
            return self.read_from_file()

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None


def parse_decodio_data(
    host: Optional[str] = None,
    port: Optional[int] = None,
    file_path: Optional[str] = None,
    timeout: float = 5.0
) -> Optional[List[Dict[str, Any]]]:
    """FastAPI helper."""
    parser = DecodioDataParser(host=host, port=port, file_path=file_path)

    try:
        return parser.parse_data(timeout=timeout)
    except Exception as e:
        print(f"Decodio parsing error: {e}")
        return None
    finally:
        parser.close()


def parse_decodio_log_line(line: str) -> Dict[str, Any]:
    """Parse Decodio pipe-delimited log line."""
    try:
        parts = line.split("|")
        parsed = {}

        for part in parts:
            part = part.strip()

            if ":" not in part:
                continue

            key, value = part.split(":", 1)
            parsed[key.strip()] = value.strip()

        return normalize_record(parsed)

    except Exception as e:
        return {
            "error": str(e),
            "raw_line": line,
        }


def parse_decodio_log_file(content: str) -> List[Dict[str, Any]]:
    """
    Parse Decodio log file supporting:
    - JSON array
    - single JSON object
    - multiple JSON objects in sequence
    - JSON lines
    - pipe-delimited text lines
    """
    records: List[Dict[str, Any]] = []

    stripped = clean_json_content(content)
    if not stripped:
        return records

    # Case 1: entire content is a JSON array
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict):
                    records.append(normalize_record(item))
            return records
        elif isinstance(parsed, dict):
            return [normalize_record(parsed)]
    except json.JSONDecodeError:
        pass

    # Case 2: multiple JSON objects one after another
    decoder = json.JSONDecoder()
    idx = 0
    length = len(stripped)
    json_records_found = False

    while idx < length:
        while idx < length and stripped[idx].isspace():
            idx += 1

        if idx < length and stripped[idx] == "{":
            try:
                obj, end = decoder.raw_decode(stripped, idx)
                if isinstance(obj, dict):
                    records.append(normalize_record(obj))
                    json_records_found = True
                idx = end
                continue
            except json.JSONDecodeError:
                break
        else:
            break

    if json_records_found:
        return records

    # Case 3: JSON lines or pipe-delimited lines
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue

        cleaned_line = clean_json_content(line)

        try:
            obj = json.loads(cleaned_line)
            if isinstance(obj, dict):
                records.append(normalize_record(obj))
                continue
        except json.JSONDecodeError:
            pass

        parsed_line = parse_decodio_log_line(line)
        if parsed_line:
            records.append(parsed_line)

    return records