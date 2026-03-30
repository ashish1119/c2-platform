import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import require_permission
from app.schemas import AssetCreate, AssetRead, AssetUpdate
from app.services.asset_service import (
	create_asset,
	list_assets,
	update_asset,
	delete_asset,
)

router = APIRouter(prefix="/assets", tags=["assets"])


def _to_asset_read(row):
	return AssetRead(
		id=row.id,
		name=row.name,
		type=row.type,
		status=row.status,
		latitude=row.latitude,
		longitude=row.longitude,
		height_m=row.height_m,
		range_m=row.range_m,
		bearing_deg=row.bearing_deg,
		fov_deg=row.fov_deg,
		df_radius_m=row.df_radius_m,
		created_at=row.created_at,
	)


@router.post("", response_model=AssetRead, include_in_schema=False)
@router.post("/", response_model=AssetRead)
async def create(data: AssetCreate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_permission("assets", "write"))):
	row = await create_asset(data, db)
	return _to_asset_read(row)


@router.put("/{asset_id}", response_model=AssetRead)
async def update(asset_id: uuid.UUID, data: AssetUpdate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_permission("assets", "write"))):
	row = await update_asset(asset_id, data, db)
	return _to_asset_read(row)


@router.delete("/{asset_id}")
async def remove(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_permission("assets", "write"))):
	await delete_asset(asset_id, db)
	return {"status": "ok"}


@router.get("", response_model=list[AssetRead], include_in_schema=False)
@router.get("/", response_model=list[AssetRead])
async def list_all(db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_permission("assets", "read"))):
	rows = await list_assets(db)
	return [_to_asset_read(row) for row in rows]
