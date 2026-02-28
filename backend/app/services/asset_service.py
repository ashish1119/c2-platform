from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.elements import WKTElement
from geoalchemy2 import Geometry
from app.models import Asset


async def create_asset(data, db: AsyncSession):
    asset = Asset(
        name=data.name,
        type=data.type,
        status=data.status,
        location=WKTElement(f"POINT({data.longitude} {data.latitude})", srid=4326),
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    row = await db.execute(
        select(
            Asset.id,
            Asset.name,
            Asset.type,
            Asset.status,
            func.ST_Y(Asset.location.cast(Geometry)).label("latitude"),
            func.ST_X(Asset.location.cast(Geometry)).label("longitude"),
            Asset.created_at,
        ).where(Asset.id == asset.id)
    )
    return row.one()


async def list_assets(db: AsyncSession):
    result = await db.execute(
        select(
            Asset.id,
            Asset.name,
            Asset.type,
            Asset.status,
            func.ST_Y(Asset.location.cast(Geometry)).label("latitude"),
            func.ST_X(Asset.location.cast(Geometry)).label("longitude"),
            Asset.created_at,
        )
    )
    return result.all()
