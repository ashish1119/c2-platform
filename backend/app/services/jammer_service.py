from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.elements import WKTElement
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


async def ensure_default_jammer(db: AsyncSession):
    existing_asset_row = await db.execute(
        select(Asset)
        .where(Asset.type == "JAMMER")
        .order_by(Asset.created_at.asc())
    )
    jammer_asset = existing_asset_row.scalars().first()

    if jammer_asset is None:
        jammer_asset = Asset(
            name="Vector Jammer Unit 1",
            type="JAMMER",
            status="ACTIVE",
            location=WKTElement("POINT(77.5680 12.9480)", srid=4326),
        )
        db.add(jammer_asset)
        await db.flush()

    existing_profile_row = await db.execute(
        select(JammerProfile).where(JammerProfile.asset_id == jammer_asset.id)
    )
    jammer_profile = existing_profile_row.scalars().first()

    if jammer_profile is None:
        jammer_profile = JammerProfile(
            asset_id=jammer_asset.id,
            manufacturer="Example Defense Systems Ltd",
            model_number="XJ-4000",
            serial_number="SN-XJ4-24-000198",
            jammer_subtype="COMMUNICATIONS_JAMMER",
            mission_domain="LAND",
            platform_type="GROUND_VEHICLE",
            ip_address="127.0.0.1",
            port=5001,
            rf_coverage_min_mhz=20.0,
            rf_coverage_max_mhz=6000.0,
            security_classification="SECRET",
            lifecycle_state="ACTIVE_SERVICE",
        )
        db.add(jammer_profile)

    await db.commit()
