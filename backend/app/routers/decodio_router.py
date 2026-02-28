from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import require_permission
from app.database import get_db
from app.integrations.decodio.service import DecodioIntegrationService
from app.schemas import DecodioConfigRead, DecodioConfigUpdate
from app.services.decodio_config_service import get_decodio_config, update_decodio_config

router = APIRouter(prefix="/decodio", tags=["decodio"])


def get_decodio_service(request: Request) -> DecodioIntegrationService:
    service: DecodioIntegrationService | None = getattr(request.app.state, "decodio_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="Decodio integration not configured")
    if not service.enabled:
        raise HTTPException(status_code=503, detail="Decodio integration disabled")
    return service


@router.get("/health")
async def get_decodio_health(
    request: Request,
    _: dict = Depends(require_permission("decodio", "read")),
):
    service: DecodioIntegrationService | None = getattr(request.app.state, "decodio_service", None)
    if service is None:
        return {
            "enabled": False,
            "state": "NOT_CONFIGURED",
            "connected": False,
            "host": "",
            "port": 0,
            "reconnect_attempts": 0,
            "last_error": None,
            "last_message_at": None,
        }
    payload = service.health().model_dump()
    payload["cache"] = service.cache.snapshot()
    return payload


@router.post("/devices/modify")
async def modify_device(
    request: Request,
    payload: dict[str, Any],
    _: dict = Depends(require_permission("decodio", "write")),
):
    service = get_decodio_service(request)
    return await service.modify_device(payload)


@router.post("/devices/start")
async def start_device(
    request: Request,
    payload: dict[str, Any],
    _: dict = Depends(require_permission("decodio", "write")),
):
    service = get_decodio_service(request)
    return await service.start_device(payload)


@router.post("/devices/stop")
async def stop_device(
    request: Request,
    payload: dict[str, Any],
    _: dict = Depends(require_permission("decodio", "write")),
):
    service = get_decodio_service(request)
    return await service.stop_device(payload)


@router.post("/devices/delete")
async def delete_device(
    request: Request,
    payload: dict[str, Any],
    _: dict = Depends(require_permission("decodio", "write")),
):
    service = get_decodio_service(request)
    return await service.delete_device(payload)


@router.post("/streams/modify")
async def modify_stream(
    request: Request,
    payload: dict[str, Any],
    _: dict = Depends(require_permission("decodio", "write")),
):
    service = get_decodio_service(request)
    return await service.modify_stream(payload)


@router.post("/streams/delete")
async def delete_stream(
    request: Request,
    payload: dict[str, Any],
    _: dict = Depends(require_permission("decodio", "write")),
):
    service = get_decodio_service(request)
    return await service.delete_stream(payload)


@router.post("/methods/get-carrier-info")
async def get_carrier_info(
    request: Request,
    _: dict = Depends(require_permission("decodio", "read")),
):
    service = get_decodio_service(request)
    return await service.get_carrier_info()


@router.post("/methods/add-neighbour-streams")
async def add_neighbour_streams(
    request: Request,
    payload: dict[str, Any],
    _: dict = Depends(require_permission("decodio", "write")),
):
    service = get_decodio_service(request)
    return await service.add_neighbour_streams(payload)


@router.post("/seed-test-events")
async def seed_test_events(
    request: Request,
    _: dict = Depends(require_permission("decodio", "write")),
):
    service = get_decodio_service(request)
    return await service.seed_test_events()


@router.get("/config", response_model=DecodioConfigRead)
async def get_config(
    _: dict = Depends(require_permission("decodio", "read")),
    db: AsyncSession = Depends(get_db),
):
    return await get_decodio_config(db)


@router.put("/config", response_model=DecodioConfigRead)
async def put_config(
    request: Request,
    payload: DecodioConfigUpdate,
    _: dict = Depends(require_permission("decodio", "write")),
    db: AsyncSession = Depends(get_db),
):
    updated = await update_decodio_config(db, payload)
    service: DecodioIntegrationService | None = getattr(request.app.state, "decodio_service", None)
    if service is not None:
        await service.apply_runtime_config(
            enabled=updated.enabled,
            host=updated.host,
            port=updated.port,
            connect_timeout=updated.connect_timeout_seconds,
            read_timeout=updated.read_timeout_seconds,
            heartbeat_interval=updated.heartbeat_interval_seconds,
            reconnect_max_seconds=updated.reconnect_max_seconds,
            ack_timeout_seconds=updated.ack_timeout_seconds,
            json_format=updated.json_format,
            event_aliases=updated.event_aliases,
        )
    return updated
