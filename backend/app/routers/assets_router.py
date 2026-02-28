from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import AssetCreate, AssetRead
from app.services.asset_service import (
	create_asset,
	list_assets,
)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("/", response_model=AssetRead)
async def create(data: AssetCreate, db: AsyncSession = Depends(get_db)):
	row = await create_asset(data, db)
	return AssetRead(
		id=row.id,
		name=row.name,
		type=row.type,
		status=row.status,
		latitude=row.latitude,
		longitude=row.longitude,
		created_at=row.created_at,
	)


@router.get("/", response_model=list[AssetRead])
async def list_all(db: AsyncSession = Depends(get_db)):
	rows = await list_assets(db)
	return [
		AssetRead(
			id=row.id,
			name=row.name,
			type=row.type,
			status=row.status,
			latitude=row.latitude,
			longitude=row.longitude,
			created_at=row.created_at,
		)
		for row in rows
	]
