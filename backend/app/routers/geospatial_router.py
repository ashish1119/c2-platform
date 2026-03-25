from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_permission
from app.schemas import (
    CoordinateConvertRequest,
    CoordinateConvertResponse,
    GeospatialSourceRead,
    GeospatialSourceRegisterRequest,
    GeospatialSourceUpdateRequest,
)
from app.services.geospatial_service import geospatial_service

router = APIRouter(prefix="/geospatial", tags=["geospatial"])


@router.get("/capabilities")
async def get_capabilities(_: dict = Depends(require_permission("geospatial", "read"))):
    return geospatial_service.capabilities()


@router.get("/ingestion/sources", response_model=list[GeospatialSourceRead])
async def get_ingestion_sources(
    active_only: bool = Query(default=False),
    _: dict = Depends(require_permission("geospatial", "read")),
    db: AsyncSession = Depends(get_db),
):
    return await geospatial_service.list_sources_filtered(db, active_only=active_only)


@router.post("/ingestion/sources", response_model=GeospatialSourceRead)
async def register_ingestion_source(
    payload: GeospatialSourceRegisterRequest,
    claims: dict = Depends(require_permission("geospatial", "write")),
    db: AsyncSession = Depends(get_db),
):
    user_id = claims.get("sub")
    return await geospatial_service.register_source(
        db,
        source_name=payload.source_name,
        source_type=payload.source_type,
        transport=payload.transport,
        classification=payload.classification,
        metadata=payload.metadata,
        user_id=user_id,
    )


@router.patch("/ingestion/sources/{source_id}", response_model=GeospatialSourceRead)
async def update_ingestion_source(
    source_id: str = Path(...),
    payload: GeospatialSourceUpdateRequest = ...,
    claims: dict = Depends(require_permission("geospatial", "write")),
    db: AsyncSession = Depends(get_db),
):
    return await geospatial_service.update_source(
        db,
        source_id=source_id,
        user_id=claims.get("sub"),
        source_name=payload.source_name,
        source_type=payload.source_type,
        transport=payload.transport,
        classification=payload.classification,
        metadata=payload.metadata,
    )


@router.post("/ingestion/sources/{source_id}/deactivate", response_model=GeospatialSourceRead)
async def deactivate_ingestion_source(
    source_id: str = Path(...),
    claims: dict = Depends(require_permission("geospatial", "write")),
    db: AsyncSession = Depends(get_db),
):
    return await geospatial_service.deactivate_source(
        db,
        source_id=source_id,
        user_id=claims.get("sub"),
    )


@router.post("/ingestion/sources/{source_id}/activate", response_model=GeospatialSourceRead)
async def activate_ingestion_source(
    source_id: str = Path(...),
    claims: dict = Depends(require_permission("geospatial", "write")),
    db: AsyncSession = Depends(get_db),
):
    return await geospatial_service.activate_source(
        db,
        source_id=source_id,
        user_id=claims.get("sub"),
    )


@router.post("/coordinates/convert", response_model=CoordinateConvertResponse)
async def convert_coordinates(
    payload: CoordinateConvertRequest,
    _: dict = Depends(require_permission("geospatial", "read")),
):
    result = geospatial_service.convert_coordinates(
        source_system=payload.source_system,
        target_system=payload.target_system,
        latitude=payload.latitude,
        longitude=payload.longitude,
        easting=payload.easting,
        northing=payload.northing,
        utm_zone=payload.utm_zone,
        hemisphere=payload.hemisphere,
        mgrs_value=payload.mgrs,
    )
    return {
        "source_system": payload.source_system.strip().upper(),
        "target_system": payload.target_system.strip().upper(),
        "result": result,
    }
