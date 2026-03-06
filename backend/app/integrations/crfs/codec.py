from __future__ import annotations

import importlib
import struct
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.integrations.crfs.keys import KEY_NAMES, NAME_ALIASES

pbd2_pb2 = None
_pbd2_import_error: Exception | None = None


def _load_pbd2_module():
    global pbd2_pb2, _pbd2_import_error

    if pbd2_pb2 is not None:
        return pbd2_pb2

    importlib.invalidate_caches()
    try:
        module = importlib.import_module("app.integrations.crfs.generated.pbd2_pb2")
        pbd2_pb2 = module
        _pbd2_import_error = None
        return module
    except Exception as exc:
        _pbd2_import_error = exc
        return None


@dataclass
class CrfsDecodedMessage:
    name: str | None
    timestamp: datetime
    unix_time: float | None
    stream_guid: str | None
    stream_name: str | None
    stream_color: int | None
    origin_guid: str | None
    origin_name: str | None
    data_clear: bool
    volatility: str | None
    end_of_stream: bool
    end_of_origin: bool
    end_of_file: bool
    telemetry: dict[str, Any] = field(default_factory=dict)
    arrays: dict[str, list[float] | list[list[float]]] = field(default_factory=dict)
    embedded_data: list[dict[str, Any]] = field(default_factory=list)


def decode_data_generic_payload(payload: bytes) -> CrfsDecodedMessage:
    module = _load_pbd2_module()
    if module is None:
        reason = f" ({_pbd2_import_error})" if _pbd2_import_error else ""
        raise RuntimeError(
            "CRFS protobuf classes not available. "
            "Generate app/integrations/crfs/generated/pbd2_pb2.py and restart the backend"
            f"{reason}"
        )

    message = module.DataGeneric()
    message.ParseFromString(payload)
    return decode_data_generic(message)


def decode_data_generic(message, depth: int = 0) -> CrfsDecodedMessage:
    if depth > 6:
        raise ValueError("Maximum DataGeneric nesting exceeded")

    timestamp, unix_time = _resolve_timestamp(message)
    stream_guid, stream_name, stream_color = _resolve_thread_id(getattr(message, "StreamID", None))
    origin_guid, origin_name, _ = _resolve_thread_id(getattr(message, "OriginID", None))

    decoded = CrfsDecodedMessage(
        name=_safe_string(message, "Name"),
        timestamp=timestamp,
        unix_time=unix_time,
        stream_guid=stream_guid,
        stream_name=stream_name,
        stream_color=stream_color,
        origin_guid=origin_guid,
        origin_name=origin_name,
        data_clear=_safe_bool(message, "DataClear", default=False),
        volatility=_resolve_volatility(message),
        end_of_stream=_safe_bool(message, "EndOfStream", default=False),
        end_of_origin=_safe_bool(message, "EndOfOrigin", default=False),
        end_of_file=_safe_bool(message, "EndOfFile", default=False),
    )

    _extract_collection(decoded, getattr(message, "CustomAttributes", None), depth)
    _extract_collection(decoded, getattr(message, "Data", None), depth)
    return decoded


def _extract_collection(decoded: CrfsDecodedMessage, collection, depth: int) -> None:
    if collection is None:
        return

    elements = getattr(collection, "Elements", [])
    for element in elements:
        key_name = _element_key_name(element)
        values = _extract_scalar_values(element)

        if key_name and values:
            decoded.telemetry[key_name] = values[0] if len(values) == 1 else values

        element_name = _normalize_name(_safe_string(element, "Name"))
        if element_name and values and element_name not in decoded.telemetry:
            decoded.telemetry[element_name] = values[0] if len(values) == 1 else values

        trace_values = _extract_trace_values(element)
        if trace_values:
            array_key = key_name or element_name or "trace"
            decoded.arrays[array_key] = trace_values

        array2d = _extract_double_2d_values(element)
        if array2d:
            array_key = key_name or element_name or "double_2d"
            decoded.arrays[array_key] = array2d

        embedded = _extract_embedded_data_generics(element, depth)
        if embedded:
            decoded.embedded_data.extend(embedded)


def _element_key_name(element) -> str | None:
    if _has_field(element, "Key"):
        try:
            key_value = int(getattr(element, "Key"))
            return KEY_NAMES.get(key_value)
        except Exception:
            return None

    element_name = _safe_string(element, "Name")
    if not element_name:
        return None
    return NAME_ALIASES.get(_normalize_name(element_name))


def _extract_scalar_values(element) -> list[Any]:
    values: list[Any] = []

    if _has_field(element, "BoolData"):
        values.extend(bool(v) for v in getattr(element.BoolData, "Values", []))

    if _has_field(element, "DoubleData"):
        values.extend(float(v) for v in getattr(element.DoubleData, "Values", []))

    if _has_field(element, "IntData"):
        values.extend(int(v) for v in getattr(element.IntData, "Values", []))

    if _has_field(element, "UIntData"):
        values.extend(int(v) for v in getattr(element.UIntData, "Values", []))

    if _has_field(element, "StringData"):
        values.extend(str(v) for v in getattr(element.StringData, "Values", []))

    if _has_field(element, "GuidData"):
        values.extend(str(v) for v in getattr(element.GuidData, "GuidStrings", []))

    return values


def _extract_trace_values(element) -> list[float]:
    if not _has_field(element, "TraceData"):
        return []

    trace = element.TraceData
    values: list[float] = []
    if _has_field(trace, "YDataStore"):
        values.extend(_decode_data_storage(trace.YDataStore))
    if _has_field(trace, "ZDataStore"):
        values.extend(_decode_data_storage(trace.ZDataStore))
    return values


def _extract_double_2d_values(element) -> list[list[float]]:
    if not _has_field(element, "Double2dData"):
        return []

    payload = element.Double2dData
    if not _has_field(payload, "DataStore"):
        return []

    width = int(getattr(payload, "Width", 0) or 0)
    flat = _decode_data_storage(payload.DataStore)
    if not flat:
        return []
    if width <= 0:
        return [flat]

    matrix: list[list[float]] = []
    for index in range(0, len(flat), width):
        matrix.append(flat[index : index + width])
    return matrix


def _extract_embedded_data_generics(element, depth: int) -> list[dict[str, Any]]:
    if not _has_field(element, "EmbeddedDataGenericData"):
        return []

    result: list[dict[str, Any]] = []
    for embedded_msg in getattr(element.EmbeddedDataGenericData, "Values", []):
        try:
            decoded = decode_data_generic(embedded_msg, depth=depth + 1)
            result.append(
                {
                    "name": decoded.name,
                    "timestamp": decoded.timestamp.isoformat(),
                    "stream_guid": decoded.stream_guid,
                    "origin_guid": decoded.origin_guid,
                    "telemetry": decoded.telemetry,
                }
            )
        except Exception:
            continue
    return result


def _decode_data_storage(storage) -> list[float]:
    if _has_field(storage, "DsDouble"):
        return [float(v) for v in getattr(storage.DsDouble, "Data", [])]

    if _has_field(storage, "DsFloat"):
        return [float(v) for v in getattr(storage.DsFloat, "Values", [])]

    if _has_field(storage, "DsDouble8"):
        return _decode_scaled_bytes(storage.DsDouble8.Bytes, 1, storage.DsDouble8.Min, storage.DsDouble8.Max)

    if _has_field(storage, "DsDouble16"):
        return _decode_scaled_bytes(storage.DsDouble16.Bytes, 2, storage.DsDouble16.Min, storage.DsDouble16.Max)

    if _has_field(storage, "DsDouble32"):
        return _decode_scaled_bytes(storage.DsDouble32.Bytes, 4, storage.DsDouble32.Min, storage.DsDouble32.Max)

    return []


def _decode_scaled_bytes(raw: bytes, sample_width: int, min_value: float, max_value: float) -> list[float]:
    if not raw:
        return []

    if sample_width not in (1, 2, 4):
        return []

    count = len(raw) // sample_width
    if count <= 0:
        return []

    if sample_width == 1:
        fmt = f"<{count}B"
    elif sample_width == 2:
        fmt = f"<{count}H"
    else:
        fmt = f"<{count}I"

    unpacked = struct.unpack(fmt, raw[: count * sample_width])

    minimum = float(min_value)
    maximum = float(max_value)
    if maximum <= minimum:
        return [minimum for _ in unpacked]

    denominator = float((1 << (8 * sample_width)) - 1)
    return [minimum + (float(item) / denominator) * (maximum - minimum) for item in unpacked]


def _resolve_timestamp(message) -> tuple[datetime, float | None]:
    if _has_field(message, "UnixTime"):
        try:
            unix_time = float(getattr(message, "UnixTime"))
            timestamp = datetime.fromtimestamp(unix_time, tz=timezone.utc)
            return timestamp, unix_time
        except Exception:
            pass
    now = datetime.now(timezone.utc)
    return now, None


def _resolve_thread_id(thread) -> tuple[str | None, str | None, int | None]:
    if thread is None:
        return None, None, None

    guid = _safe_string(thread, "GuidString")
    name = _safe_string(thread, "Name")

    color: int | None = None
    if _has_field(thread, "ColorARGB"):
        try:
            color = int(getattr(thread, "ColorARGB"))
        except Exception:
            color = None

    return guid, name, color


def _resolve_volatility(message) -> str | None:
    if not _has_field(message, "Volatility"):
        return None

    try:
        value = int(getattr(message, "Volatility"))
    except Exception:
        return None

    if value == 1:
        return "STATIC"
    if value == 0:
        return "DYNAMIC"
    return str(value)


def _safe_string(message, field_name: str) -> str | None:
    if not _has_field(message, field_name):
        return None
    value = getattr(message, field_name)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _safe_bool(message, field_name: str, default: bool = False) -> bool:
    if not _has_field(message, field_name):
        return default
    return bool(getattr(message, field_name))


def _normalize_name(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.strip().lower().replace(" ", "_").replace("-", "_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized


def _has_field(message, field_name: str) -> bool:
    if message is None:
        return False

    has_field = getattr(message, "HasField", None)
    if callable(has_field):
        try:
            return bool(has_field(field_name))
        except Exception:
            pass

    value = getattr(message, field_name, None)
    if value is None:
        return False

    if isinstance(value, (str, bytes, list, tuple, dict)):
        return len(value) > 0

    return True
