from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import User
from app.core.security import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.post("/login")
async def login(data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.username == data["username"])
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(
        data["password"], user.hashed_password
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        {"sub": str(user.id), "role": user.role.name}
    )

    return {"access_token": token}