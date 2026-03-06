import uuid
from fastapi import HTTPException, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.elements import WKTElement
from geoalchemy2 import Geometry
from app.models import Asset, DirectionFinderProfile, JammerProfile


def _normalize_asset_type(raw_type: str | None) -> str | None:
    if raw_type is None:
        return None

    normalized = raw_type.strip().upper().replace("-", "_").replace(" ", "_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")

    condensed = normalized.replace("_", "")
    if condensed in {"DF", "DIRECTIONFINDER"}:
        return "DIRECTION_FINDER"
    if condensed in {"C2", "C2NODE"}:
        return "C2_NODE"
    if condensed == "JAMMER":
        return "JAMMER"
    return normalized


def _asset_projection():
    return (
        select(
            Asset.id,
            Asset.name,
            Asset.type,
            Asset.status,
            func.ST_Y(Asset.location.cast(Geometry)).label("latitude"),
            func.ST_X(Asset.location.cast(Geometry)).label("longitude"),
            Asset.height_m,
            Asset.range_m,
            Asset.bearing_deg,
            Asset.fov_deg,
            DirectionFinderProfile.survey_position_accuracy_m.label("df_radius_m"),
            Asset.created_at,
        )
        .outerjoin(DirectionFinderProfile, DirectionFinderProfile.asset_id == Asset.id)
    )


async def create_asset(data, db: AsyncSession):
    asset = Asset(
        name=data.name,
        type=_normalize_asset_type(data.type),
        status=data.status,
        location=WKTElement(f"POINT({data.longitude} {data.latitude})", srid=4326),
        height_m=data.height_m,
        range_m=data.range_m,
        bearing_deg=data.bearing_deg,
        fov_deg=data.fov_deg,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    row = await db.execute(_asset_projection().where(Asset.id == asset.id))
    return row.one()


async def update_asset(asset_id: uuid.UUID, data, db: AsyncSession):
    asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    asset.name = data.name
    asset.type = _normalize_asset_type(data.type)
    asset.status = data.status
    asset.location = WKTElement(f"POINT({data.longitude} {data.latitude})", srid=4326)
    asset.height_m = data.height_m
    asset.range_m = data.range_m
    asset.bearing_deg = data.bearing_deg
    asset.fov_deg = data.fov_deg

    await db.commit()

    row = await db.execute(_asset_projection().where(Asset.id == asset_id))
    return row.one()


async def delete_asset(asset_id: uuid.UUID, db: AsyncSession):
    asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    await db.execute(delete(DirectionFinderProfile).where(DirectionFinderProfile.asset_id == asset_id))
    await db.execute(delete(JammerProfile).where(JammerProfile.asset_id == asset_id))
    await db.delete(asset)
    await db.commit()


async def list_assets(db: AsyncSession):
    result = await db.execute(_asset_projection())
    return result.all()
