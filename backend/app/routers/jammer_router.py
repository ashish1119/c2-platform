import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_user_claims
from app.schemas import JammerProfileCreate, JammerProfileRead, JammerProfileUpdate
from app.services.jammer_service import (
    create_jammer_profile,
    delete_jammer_profile,
    get_jammer_profile,
    list_jammer_profiles,
    update_jammer_profile,
)

router = APIRouter(prefix="/jammers", tags=["jammers"])


@router.post("", response_model=JammerProfileRead, include_in_schema=False)
@router.post("/", response_model=JammerProfileRead)
async def create(data: JammerProfileCreate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    try:
        row = await create_jammer_profile(data, db)
        return row
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=list[JammerProfileRead], include_in_schema=False)
@router.get("/", response_model=list[JammerProfileRead])
async def list_all(db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    rows = await list_jammer_profiles(db)
    return rows


@router.get("/{profile_id}", response_model=JammerProfileRead)
async def get_one(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    row = await get_jammer_profile(profile_id, db)
    if row is None:
        raise HTTPException(status_code=404, detail="Jammer profile not found")
    return row


@router.patch("/{profile_id}", response_model=JammerProfileRead)
async def update(profile_id: uuid.UUID, data: JammerProfileUpdate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    row = await update_jammer_profile(profile_id, data, db)
    if row is None:
        raise HTTPException(status_code=404, detail="Jammer profile not found")
    return row


@router.delete("/{profile_id}")
async def delete(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    deleted = await delete_jammer_profile(profile_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Jammer profile not found")
    return {"deleted": True}
