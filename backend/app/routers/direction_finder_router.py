import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_user_claims
from app.schemas import (
    DirectionFinderProfileCreate,
    DirectionFinderProfileRead,
    DirectionFinderProfileUpdate,
)
from app.services.direction_finder_service import (
    create_direction_finder_profile,
    delete_direction_finder_profile,
    export_direction_finder_profiles_csv,
    export_direction_finder_profiles_xml,
    get_direction_finder_profile,
    import_direction_finder_profiles_csv,
    import_direction_finder_profiles_xml,
    list_direction_finder_profiles,
    update_direction_finder_profile,
)

router = APIRouter(prefix="/direction-finders", tags=["direction-finders"])


def _to_direction_finder_profile_read(row) -> DirectionFinderProfileRead:
    payload = {column.name: getattr(row, column.name) for column in row.__table__.columns}
    payload["antenna_polarization_support"] = payload.get("antenna_polarization_support") or []
    payload["df_methods_supported"] = payload.get("df_methods_supported") or []
    payload["lever_arm_offset_m"] = payload.get("lever_arm_offset_m") or {}
    payload["transport_protocols"] = payload.get("transport_protocols") or []
    payload["message_protocols"] = payload.get("message_protocols") or []
    payload["data_format_profiles"] = payload.get("data_format_profiles") or []
    payload["geodetic_datum"] = payload.get("geodetic_datum") or "WGS84"
    payload["altitude_reference"] = payload.get("altitude_reference") or "MSL"
    payload["secure_boot_enabled"] = (
        True if payload.get("secure_boot_enabled") is None else payload.get("secure_boot_enabled")
    )
    return DirectionFinderProfileRead.model_validate(payload)


@router.post("", response_model=DirectionFinderProfileRead, include_in_schema=False)
@router.post("/", response_model=DirectionFinderProfileRead)
async def create(data: DirectionFinderProfileCreate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    try:
        row = await create_direction_finder_profile(data, db)
        return _to_direction_finder_profile_read(row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=list[DirectionFinderProfileRead], include_in_schema=False)
@router.get("/", response_model=list[DirectionFinderProfileRead])
async def list_all(db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    rows = await list_direction_finder_profiles(db)
    return [_to_direction_finder_profile_read(row) for row in rows]


@router.get("/{profile_id}", response_model=DirectionFinderProfileRead)
async def get_one(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    row = await get_direction_finder_profile(profile_id, db)
    if row is None:
        raise HTTPException(status_code=404, detail="Direction finder profile not found")
    return _to_direction_finder_profile_read(row)


@router.patch("/{profile_id}", response_model=DirectionFinderProfileRead)
async def update(profile_id: uuid.UUID, data: DirectionFinderProfileUpdate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    try:
        row = await update_direction_finder_profile(profile_id, data, db)
        if row is None:
            raise HTTPException(status_code=404, detail="Direction finder profile not found")
        return _to_direction_finder_profile_read(row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{profile_id}")
async def delete(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    deleted = await delete_direction_finder_profile(profile_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Direction finder profile not found")
    return {"deleted": True}


@router.get("/export/csv")
async def export_csv(db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    rows = await list_direction_finder_profiles(db)
    return PlainTextResponse(export_direction_finder_profiles_csv(rows), media_type="text/csv")


@router.get("/export/xml")
async def export_xml(db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    rows = await list_direction_finder_profiles(db)
    return PlainTextResponse(export_direction_finder_profiles_xml(rows), media_type="application/xml")


@router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV file required")
    content = (await file.read()).decode("utf-8")
    try:
        return await import_direction_finder_profiles_csv(content, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/import/xml")
async def import_xml(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    if not file.filename.lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="XML file required")
    content = (await file.read()).decode("utf-8")
    try:
        return await import_direction_finder_profiles_xml(content, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
