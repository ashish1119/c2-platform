import asyncio
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlunparse
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query

from app.deps import require_permission

router = APIRouter(prefix="/jammer-control", tags=["jammer-control"])

DEFAULT_JAMMER_API_TARGET = "localhost:3333"
REQUEST_TIMEOUT_SECONDS = 10


def _normalize_api_target(api_target: str | None) -> str:
    target = (api_target or DEFAULT_JAMMER_API_TARGET).strip()
    if not target:
        raise HTTPException(status_code=400, detail="api_target is required")

    if not target.startswith("http://") and not target.startswith("https://"):
        target = f"http://{target}"

    parsed = urlparse(target)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid api_target. Use IP:port or URL")

    host = (parsed.hostname or "").lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        mapped_host = "host.docker.internal"
        if parsed.port is not None:
            netloc = f"{mapped_host}:{parsed.port}"
        else:
            netloc = mapped_host
        parsed = parsed._replace(netloc=netloc)

    base = urlunparse((parsed.scheme, parsed.netloc, "", "", "", "")).rstrip("/")
    return base


def _parse_response_body(body_text: str) -> Any:
    if not body_text:
        return {}

    try:
        return json.loads(body_text)
    except json.JSONDecodeError:
        return {"raw": body_text}


def _extract_error_message(error_body: Any, fallback: str) -> str:
    if isinstance(error_body, dict):
        detail = error_body.get("detail") or error_body.get("message")
        if isinstance(detail, str) and detail.strip():
            return detail
    if isinstance(error_body, str) and error_body.strip():
        return error_body
    return fallback


def _proxy_request(
    api_target: str | None,
    endpoint: str,
    method: str,
    payload: dict[str, Any] | None = None,
) -> Any:
    api_base = _normalize_api_target(api_target)
    url = f"{api_base}{endpoint}"

    body: bytes | None = None
    headers: dict[str, str] = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url=url, data=body, headers=headers, method=method)

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            body_text = response.read().decode("utf-8")
            return _parse_response_body(body_text)
    except HTTPError as exc:
        response_text = exc.read().decode("utf-8", errors="replace")
        parsed_error = _parse_response_body(response_text)
        detail = _extract_error_message(parsed_error, f"Jammer API error ({exc.code})")
        raise HTTPException(status_code=exc.code, detail=detail) from exc
    except URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to reach Jammer API at {api_base}",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Jammer API request failed") from exc


@router.get("/ports")
async def get_ports(
    api_target: str = Query(default=DEFAULT_JAMMER_API_TARGET),
    _: dict = Depends(require_permission("jammer", "read")),
):
    return await asyncio.to_thread(_proxy_request, api_target, "/ports", "GET")


@router.post("/connect")
async def connect(
    payload: dict[str, Any],
    api_target: str = Query(default=DEFAULT_JAMMER_API_TARGET),
    _: dict = Depends(require_permission("jammer", "write")),
):
    return await asyncio.to_thread(_proxy_request, api_target, "/connect", "POST", payload)


@router.post("/configure")
async def configure(
    payload: dict[str, Any],
    api_target: str = Query(default=DEFAULT_JAMMER_API_TARGET),
    _: dict = Depends(require_permission("jammer", "write")),
):
    return await asyncio.to_thread(_proxy_request, api_target, "/configure", "POST", payload)


@router.post("/jamming/start")
async def start_jamming(
    payload: dict[str, Any],
    api_target: str = Query(default=DEFAULT_JAMMER_API_TARGET),
    _: dict = Depends(require_permission("jammer", "write")),
):
    return await asyncio.to_thread(_proxy_request, api_target, "/jamming/start", "POST", payload)


@router.post("/jamming/stop")
async def stop_jamming(
    api_target: str = Query(default=DEFAULT_JAMMER_API_TARGET),
    _: dict = Depends(require_permission("jammer", "write")),
):
    return await asyncio.to_thread(_proxy_request, api_target, "/jamming/stop", "POST", {})
