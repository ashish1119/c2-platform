from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import AsyncSessionLocal
from app.models import User
from app.core.security import verify_password, create_access_token
from app.services.role_service import get_effective_permissions
from app.schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.username == data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(
        data.password, user.hashed_password
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        {"sub": str(user.id), "role": user.role.name}
    )

    permission_rows = await get_effective_permissions(user.role_id, db) if user.role_id else []
    permissions = [f"{row['resource']}:{row['action']}" for row in permission_rows]

    return LoginResponse(
        id=user.id,
        username=user.username,
        role=user.role.name,
        token=token,
        permissions=permissions,
    )