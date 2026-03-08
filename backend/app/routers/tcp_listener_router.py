import asyncio
import json
import socket
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from app.deps import require_permission
from app.schemas import (
    TcpClientConnectRequest,
    TcpClientStatusRead,
    TcpListenerConnectionTestRead,
    TcpListenerConnectionTestRequest,
    TcpListenerEndpointUpdateRequest,
    TcpListenerHealthRead,
    TcpListenerSendTestRead,
    TcpListenerSendTestRequest,
)

router = APIRouter(prefix="/tcp-listener", tags=["tcp-listener"])


def _test_bindability(host: str, port: int) -> tuple[bool, str]:
    try:
        addr_infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM, flags=socket.AI_PASSIVE)
    except socket.gaierror as exc:
        return False, f"Host resolution failed: {exc}"

    if not addr_infos:
        return False, "No address information resolved for host"

    last_error = "Endpoint is not bindable"
    for family, socktype, proto, _canonname, sockaddr in addr_infos:
        sock = socket.socket(family, socktype, proto)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(sockaddr)
            return True, "Endpoint is valid and can bind successfully"
        except OSError as exc:
            last_error = str(exc)
        finally:
            sock.close()

    return False, last_error


def _default_value_for_event(event_type: str) -> tuple[float, str]:
    normalized = event_type.strip().lower()
    if normalized == "df":
        return 90.0, "deg"
    if normalized == "temperature":
        return 92.7, "C"
    return 1.0, ""


def _build_test_message(payload: TcpListenerSendTestRequest) -> dict:
    default_value, default_unit = _default_value_for_event(payload.event_type)
    return {
        "msg_id": str(uuid.uuid4()),
        "sender_id": payload.sender_id,
        "source_name": payload.source_name,
        "source_type": payload.source_type,
        "source_details": {"origin": "tcp-client-ui"},
        "event_type": payload.event_type,
        "value": float(payload.value if payload.value is not None else default_value),
        "unit": payload.unit if payload.unit is not None else default_unit,
        "severity_hint": payload.severity_hint,
        "ts": datetime.now(timezone.utc).isoformat(),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
    }


def _send_tcp_line(host: str, port: int, message: dict) -> None:
    line = json.dumps(message, separators=(",", ":")) + "\n"
    with socket.create_connection((host, port), timeout=5) as sock:
        sock.sendall(line.encode("utf-8"))


@router.get("/health", response_model=TcpListenerHealthRead)
async def health(
    request: Request,
    _claims: dict = Depends(require_permission("tcp_listener", "read")),
):
    service = getattr(request.app.state, "tcp_listener_service", None)
    if service is None:
        return TcpListenerHealthRead(
            enabled=False,
            running=False,
            host="",
            port=0,
            active_connections=0,
            total_connections=0,
            messages_received=0,
            messages_rejected=0,
            idle_timeout_seconds=0,
            max_line_bytes=0,
        )

    return TcpListenerHealthRead(**service.get_health_snapshot())


@router.get("/client/status", response_model=TcpClientStatusRead)
async def client_status(
    request: Request,
    _claims: dict = Depends(require_permission("tcp_listener", "read")),
):
    service = getattr(request.app.state, "tcp_listener_service", None)
    if service is None:
        return TcpClientStatusRead(
            connected=False,
            target_host=None,
            target_port=None,
            messages_received=0,
            messages_rejected=0,
            last_message_at=None,
            last_error=None,
            recent_messages=[],
        )

    return TcpClientStatusRead(**service.get_client_snapshot())


@router.post("/client/connect", response_model=TcpClientStatusRead)
async def client_connect(
    payload: TcpClientConnectRequest,
    request: Request,
    _claims: dict = Depends(require_permission("tcp_listener", "write")),
):
    service = getattr(request.app.state, "tcp_listener_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="TCP listener service unavailable")

    try:
        await service.connect_client(
            host=payload.host,
            port=payload.port,
            protocol=payload.protocol,
            length_endian=payload.length_endian,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (TimeoutError, OSError) as exc:
        raise HTTPException(status_code=400, detail=f"Unable to connect to server: {exc}") from exc

    return TcpClientStatusRead(**service.get_client_snapshot())


@router.post("/client/disconnect", response_model=TcpClientStatusRead)
async def client_disconnect(
    request: Request,
    _claims: dict = Depends(require_permission("tcp_listener", "write")),
):
    service = getattr(request.app.state, "tcp_listener_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="TCP listener service unavailable")

    await service.disconnect_client()
    return TcpClientStatusRead(**service.get_client_snapshot())


@router.put("/endpoint", response_model=TcpListenerHealthRead)
async def update_endpoint(
    payload: TcpListenerEndpointUpdateRequest,
    request: Request,
    _claims: dict = Depends(require_permission("tcp_listener", "write")),
):
    service = getattr(request.app.state, "tcp_listener_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="TCP listener service unavailable")

    try:
        await service.update_endpoint(host=payload.host, port=payload.port)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Unable to bind endpoint: {exc}") from exc

    return TcpListenerHealthRead(**service.get_health_snapshot())


@router.post("/test-connection", response_model=TcpListenerConnectionTestRead)
async def test_connection(
    payload: TcpListenerConnectionTestRequest,
    request: Request,
    _claims: dict = Depends(require_permission("tcp_listener", "write")),
):
    service = getattr(request.app.state, "tcp_listener_service", None)
    host = payload.host.strip()
    port = payload.port

    if (
        service is not None
        and service.get_health_snapshot().get("running")
        and service.host == host
        and service.port == port
    ):
        return TcpListenerConnectionTestRead(success=True, message="Listener already active on this endpoint")

    success, message = _test_bindability(host=host, port=port)
    return TcpListenerConnectionTestRead(success=success, message=message)


@router.post("/send-test", response_model=TcpListenerSendTestRead)
async def send_test_message(
    payload: TcpListenerSendTestRequest,
    _claims: dict = Depends(require_permission("tcp_listener", "write")),
):
    host = payload.host.strip()
    if not host:
        raise HTTPException(status_code=400, detail="host is required")

    message = _build_test_message(payload)

    try:
        await asyncio.to_thread(_send_tcp_line, host, payload.port, message)
    except (socket.gaierror, TimeoutError, OSError) as exc:
        raise HTTPException(status_code=400, detail=f"Unable to send TCP message: {exc}") from exc

    return TcpListenerSendTestRead(
        success=True,
        message="Test message sent successfully",
        payload=message,
    )
