from fastapi import APIRouter, Request

from app.schemas import TcpListenerHealthRead

router = APIRouter(prefix="/tcp-listener", tags=["tcp-listener"])


@router.get("/health", response_model=TcpListenerHealthRead)
async def health(request: Request):
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
