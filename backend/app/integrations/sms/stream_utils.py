import asyncio
import csv
import io
import json
from pathlib import Path
from typing import Any, Literal
from urllib import parse as urllib_parse
from urllib import request as urllib_request

MAX_UPLOAD_TEXT_BYTES = 5 * 1024 * 1024
MAX_STREAM_TEXT_BYTES = 5 * 1024 * 1024

PayloadFormat = Literal["csv", "json", "ndjson"]


def normalize_node_name(value: str, fallback: str) -> str:
    cleaned = "".join(char if (char.isalnum() or char in {"_", "-"}) else "_" for char in value)
    collapsed = "_".join(part for part in cleaned.split("_") if part)
    return (collapsed[:64] or fallback).lower()


def derive_source_node_from_filename(filename: str) -> str:
    stem = Path(filename).stem.strip()
    return normalize_node_name(stem, "uploaded_rf")


def derive_source_node_from_url(stream_url: str) -> str:
    parsed = urllib_parse.urlparse(stream_url)
    host = parsed.hostname or "stream"
    path = parsed.path.strip("/").replace("/", "_")
    raw = f"{host}_{path}" if path else host
    return normalize_node_name(raw, "stream_rf")


def extract_detections_from_json_payload(payload: Any) -> tuple[list[dict[str, Any]], str | None, dict[str, Any]]:
    source_node: str | None = None
    metrics: dict[str, Any] = {}

    if isinstance(payload, dict):
        if isinstance(payload.get("source_node"), str) and payload.get("source_node"):
            source_node = payload["source_node"]
        if isinstance(payload.get("metrics"), dict):
            metrics = payload["metrics"]

        if isinstance(payload.get("detections"), list):
            detections = [item for item in payload["detections"] if isinstance(item, dict)]
            return detections, source_node, metrics

        return [payload], source_node, metrics

    if isinstance(payload, list):
        detections = [item for item in payload if isinstance(item, dict)]
        return detections, None, {}

    raise ValueError("JSON payload must be an object or array")


def extract_detections_from_ndjson_payload(text: str) -> tuple[list[dict[str, Any]], str | None, dict[str, Any]]:
    detections: list[dict[str, Any]] = []
    source_node: str | None = None
    metrics: dict[str, Any] = {}

    for index, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        try:
            entry = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid NDJSON at line {index}") from exc

        batch, entry_source_node, entry_metrics = extract_detections_from_json_payload(entry)
        detections.extend(batch)

        if source_node is None and entry_source_node:
            source_node = entry_source_node

        if entry_metrics:
            merged_metrics = dict(metrics)
            merged_metrics.update(entry_metrics)
            metrics = merged_metrics

    return detections, source_node, metrics


def parse_uploaded_rf_file(
    filename: str,
    text: str,
) -> tuple[list[dict[str, Any]], str | None, dict[str, Any], PayloadFormat]:
    suffix = Path(filename).suffix.lower()

    if suffix == ".csv":
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise ValueError("CSV file is missing a header row")

        detections = []
        for row in reader:
            normalized = {
                key: value
                for key, value in row.items()
                if key is not None and value is not None and str(value).strip() != ""
            }
            if normalized:
                detections.append(normalized)
        return detections, None, {}, "csv"

    if suffix in {".json", ".jsn"}:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("JSON file content is invalid") from exc
        detections, source_node, metrics = extract_detections_from_json_payload(parsed)
        return detections, source_node, metrics, "json"

    if suffix in {".ndjson", ".jsonl"}:
        detections, source_node, metrics = extract_detections_from_ndjson_payload(text)
        return detections, source_node, metrics, "ndjson"

    raise ValueError("Unsupported file type. Use CSV, JSON, or NDJSON")


def _fetch_stream_payload_blocking(
    stream_url: str,
    timeout_seconds: float,
) -> tuple[list[dict[str, Any]], str | None, dict[str, Any], Literal["json", "ndjson"]]:
    parsed_url = urllib_parse.urlparse(stream_url)
    if parsed_url.scheme not in {"http", "https"}:
        raise ValueError("stream_url must use http or https")

    request = urllib_request.Request(
        url=stream_url,
        headers={"Accept": "application/json,application/x-ndjson,text/plain"},
    )

    with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
        payload_bytes = response.read(MAX_STREAM_TEXT_BYTES + 1)
        if len(payload_bytes) > MAX_STREAM_TEXT_BYTES:
            raise ValueError("Stream response is too large")

        text = payload_bytes.decode("utf-8", errors="replace")
        content_type = (response.headers.get("Content-Type") or "").lower()

    if "application/x-ndjson" in content_type:
        detections, source_node, metrics = extract_detections_from_ndjson_payload(text)
        return detections, source_node, metrics, "ndjson"

    try:
        parsed_payload = json.loads(text)
        detections, source_node, metrics = extract_detections_from_json_payload(parsed_payload)
        return detections, source_node, metrics, "json"
    except json.JSONDecodeError:
        detections, source_node, metrics = extract_detections_from_ndjson_payload(text)
        return detections, source_node, metrics, "ndjson"


async def fetch_stream_payload(
    stream_url: str,
    timeout_seconds: float,
) -> tuple[list[dict[str, Any]], str | None, dict[str, Any], Literal["json", "ndjson"]]:
    return await asyncio.to_thread(_fetch_stream_payload_blocking, stream_url, timeout_seconds)
