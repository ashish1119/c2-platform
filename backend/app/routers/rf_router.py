from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_user_claims
from app.schemas import RFSignalCreate, RFSignalRead, HeatMapCell, TriangulationResponse
from app.services.rf_service import ingest_signal, list_signals, build_heatmap, triangulate_signals

router = APIRouter(prefix="/rf", tags=["rf"])


@router.post("/signals")
async def create_signal(data: RFSignalCreate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
	signal = await ingest_signal(data, db)
	return {"id": signal.id, "status": "ingested"}


@router.get("/signals", response_model=list[RFSignalRead])
async def get_signals(
	period_start: datetime | None = Query(default=None),
	period_end: datetime | None = Query(default=None),
	db: AsyncSession = Depends(get_db),
	_claims: dict = Depends(get_current_user_claims),
):
	rows = await list_signals(db, period_start, period_end)
	return [
		RFSignalRead(
			id=row.id,
			frequency=row.frequency,
			modulation=row.modulation,
			power_level=row.power_level,
			bandwidth_hz=row.bandwidth_hz,
			confidence=row.confidence,
			doa_deg=row.doa_deg,
			latitude=row.latitude,
			longitude=row.longitude,
			detected_at=row.detected_at,
		)
		for row in rows
	]


@router.get("/heatmap", response_model=list[HeatMapCell])
async def get_heatmap(
	period_start: datetime | None = Query(default=None),
	period_end: datetime | None = Query(default=None),
	db: AsyncSession = Depends(get_db),
	_claims: dict = Depends(get_current_user_claims),
):
	rows = await build_heatmap(db, period_start, period_end)
	return [
		HeatMapCell(
			latitude_bucket=row.latitude_bucket,
			longitude_bucket=row.longitude_bucket,
			density=row.density,
		)
		for row in rows
	]


@router.get("/triangulation", response_model=TriangulationResponse)
async def get_triangulation(
	limit: int = Query(default=25, ge=2, le=200),
	ray_length_m: float = Query(default=10000.0, gt=0),
	flip_180: bool = Query(default=False),
	parallel_angle_threshold_deg: float = Query(default=5.0, ge=0.0, lt=90.0),
	max_intersection_distance_m: float = Query(default=100000.0, gt=0),
	db: AsyncSession = Depends(get_db),
	_claims: dict = Depends(get_current_user_claims),
):
	result = await triangulate_signals(
		db=db,
		limit=limit,
		ray_length_m=ray_length_m,
		flip_180=flip_180,
		parallel_angle_threshold_deg=parallel_angle_threshold_deg,
		max_intersection_distance_m=max_intersection_distance_m,
	)
	return TriangulationResponse(**result)
