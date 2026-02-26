from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas import UserCreate, UserRead
from app.models import User
from app.services.user_service import create_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserRead)
async def create(data: UserCreate, db: AsyncSession = Depends(get_db)):
    return await create_user(data, db)


@router.get("/", response_model=list[UserRead])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()