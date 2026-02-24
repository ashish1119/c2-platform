from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models import User
from sqlalchemy import select


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def require_role(role_name: str):
    async def role_checker(current_user: User = Depends()):
        if current_user.role.name != role_name:
            raise HTTPException(status_code=403, detail="Forbidden")
        return current_user
    return role_checker