from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_user_claims
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


def _require_operator_or_admin(claims: dict) -> None:
	role = str(claims.get("role", "")).upper()
	if role not in {"OPERATOR", "ADMIN"}:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _require_admin(claims: dict) -> None:
	role = str(claims.get("role", "")).upper()
	if role != "ADMIN":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.post("/statistical", response_model=StatisticalReportResponse)
async def statistical_report(
	payload: StatisticalReportRequest,
	db: AsyncSession = Depends(get_db),
	claims: dict = Depends(get_current_user_claims),
):
	_require_operator_or_admin(claims)
	report = await build_statistical_report(payload.period_start, payload.period_end, db)
	return StatisticalReportResponse(**report)


@router.post("/eob", response_model=list[EOBEntryRead])
async def eob_report(
	payload: EOBRequest,
	db: AsyncSession = Depends(get_db),
	claims: dict = Depends(get_current_user_claims),
):
	_require_operator_or_admin(claims)
	rows = await generate_eob(payload.period_start, payload.period_end, payload.eob_type, db)
	return [EOBEntryRead(**row) for row in rows]


@router.post("/planning/coverage", response_model=CoverageSimulationResponse)
async def planning_coverage(
	payload: CoverageSimulationRequest,
	claims: dict = Depends(get_current_user_claims),
):
	_require_admin(claims)
	data = simulate_coverage(payload)
	return CoverageSimulationResponse(**data)
