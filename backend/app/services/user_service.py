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

    if role_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role_id is required",
        )

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


async def update_user(user_id, data, db: AsyncSession):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    username = data.username.strip()
    email = data.email.strip()
    if not username or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and email are required",
        )

    if "role_id" in getattr(data, "model_fields_set", set()):
        role_id = getattr(data, "role_id", None)
        if role_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="role_id cannot be null",
            )

        role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role_id",
            )

        user.role_id = role_id

    user.username = username
    user.email = email

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


async def delete_user(user_id, db: AsyncSession):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await db.delete(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete user due to related records",
        )