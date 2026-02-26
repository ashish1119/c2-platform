from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import User, Role
from app.core.security import hash_password


async def create_user(data, db: AsyncSession):
    role_id = getattr(data, "role_id", None)
    if role_id is None:
        role_ids = getattr(data, "role_ids", None)
        if role_ids:
            role_id = role_ids[0]

    if role_id is not None:
        role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role_id",
            )

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        role_id=role_id,
    )

    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        )
    await db.refresh(user)

    return user