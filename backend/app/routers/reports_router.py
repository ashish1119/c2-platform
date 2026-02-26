from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import (
	StatisticalReportRequest,
	StatisticalReportResponse,
	EOBRequest,
	EOBEntryRead,
	CoverageSimulationRequest,
	CoverageSimulationResponse,
)
from app.services.report_service import build_statistical_report, generate_eob
from app.services.planning_service import simulate_coverage

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/statistical", response_model=StatisticalReportResponse)
async def statistical_report(payload: StatisticalReportRequest, db: AsyncSession = Depends(get_db)):
	report = await build_statistical_report(payload.period_start, payload.period_end, db)
	return StatisticalReportResponse(**report)


@router.post("/eob", response_model=list[EOBEntryRead])
async def eob_report(payload: EOBRequest, db: AsyncSession = Depends(get_db)):
	rows = await generate_eob(payload.period_start, payload.period_end, payload.eob_type, db)
	return [EOBEntryRead(**row) for row in rows]


@router.post("/planning/coverage", response_model=CoverageSimulationResponse)
async def planning_coverage(payload: CoverageSimulationRequest):
	data = simulate_coverage(payload)
	return CoverageSimulationResponse(**data)
