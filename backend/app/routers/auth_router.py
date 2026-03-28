from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid
from app.database import AsyncSessionLocal
from app.models import User
from app.core.security import verify_password, create_access_token, hash_password
from app.deps import get_current_user_claims
from app.services.role_service import get_effective_permissions
from app.schemas import LoginRequest, LoginResponse, ChangePasswordRequest, ResetPasswordRequest

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


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    claims: dict = Depends(get_current_user_claims),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = uuid.UUID(str(claims.get("sub")))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    result = await db.execute(
        select(User).where(
            User.username == payload.username,
            User.email == payload.email,
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found for provided username/email")

    if verify_password(payload.new_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Password reset successfully"}