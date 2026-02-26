from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import AssetCreate, AssetRead
from app.services.asset_service import (
	create_asset,
	list_assets,
	export_assets_csv,
	export_assets_xml,
	import_assets_csv,
	import_assets_xml,
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


@router.get("/export/csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
	rows = await list_assets(db)
	return PlainTextResponse(export_assets_csv(rows), media_type="text/csv")


@router.get("/export/xml")
async def export_xml(db: AsyncSession = Depends(get_db)):
	rows = await list_assets(db)
	return PlainTextResponse(export_assets_xml(rows), media_type="application/xml")


@router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
	if not file.filename.lower().endswith(".csv"):
		raise HTTPException(status_code=400, detail="CSV file required")
	content = (await file.read()).decode("utf-8")
	return await import_assets_csv(content, db)


@router.post("/import/xml")
async def import_xml(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
	if not file.filename.lower().endswith(".xml"):
		raise HTTPException(status_code=400, detail="XML file required")
	content = (await file.read()).decode("utf-8")
	return await import_assets_xml(content, db)
