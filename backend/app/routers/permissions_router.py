from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import PermissionCreate, PermissionRead
from app.services.role_service import create_permission, list_permissions

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.post("/", response_model=PermissionRead)
async def create(payload: PermissionCreate, db: AsyncSession = Depends(get_db)):
	return await create_permission(payload.resource, payload.action, payload.scope, db)


@router.get("/", response_model=list[PermissionRead])
async def list_all(db: AsyncSession = Depends(get_db)):
	return await list_permissions(db)
