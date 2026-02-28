from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Asset, JammerProfile


async def create_jammer_profile(data, db: AsyncSession):
    asset = await db.get(Asset, data.asset_id)
    if asset is None:
        raise ValueError("Asset not found")

    existing = await db.execute(select(JammerProfile).where(JammerProfile.asset_id == data.asset_id))
    if existing.scalar_one_or_none() is not None:
        raise ValueError("Jammer profile already exists for asset")

    payload = data.model_dump()
    profile = JammerProfile(**payload)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def list_jammer_profiles(db: AsyncSession):
    rows = await db.execute(select(JammerProfile).order_by(JammerProfile.created_at.desc()))
    return rows.scalars().all()


async def get_jammer_profile(profile_id, db: AsyncSession):
    row = await db.get(JammerProfile, profile_id)
    return row


async def update_jammer_profile(profile_id, data, db: AsyncSession):
    row = await db.get(JammerProfile, profile_id)
    if row is None:
        return None

    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(row, key, value)

    await db.commit()
    await db.refresh(row)
    return row


async def delete_jammer_profile(profile_id, db: AsyncSession):
    row = await db.get(JammerProfile, profile_id)
    if row is None:
        return False

    await db.delete(row)
    await db.commit()
    return True
