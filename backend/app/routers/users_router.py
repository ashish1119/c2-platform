import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.deps import get_current_user_claims
from app.schemas import UserCreate, UserRead, UserUpdate
from app.models import User
from app.services.user_service import create_user, update_user, delete_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserRead)
async def create(data: UserCreate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    return await create_user(data, db)


@router.get("/", response_model=list[UserRead])
async def list_users(db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    result = await db.execute(select(User))
    return result.scalars().all()


@router.put("/{user_id}", response_model=UserRead)
async def update(user_id: uuid.UUID, data: UserUpdate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    return await update_user(user_id, data, db)


@router.delete("/{user_id}")
async def remove(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), _claims: dict = Depends(get_current_user_claims)):
    await delete_user(user_id, db)
    return {"status": "ok"}