from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.database import Base


SCHEMA_PATCH_STATEMENTS = [
    "ALTER TABLE roles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1",
    "UPDATE roles SET level = 10 WHERE name = 'ADMIN' AND (level IS NULL OR level = 1)",
    "UPDATE roles SET level = 5 WHERE name = 'OPERATOR' AND (level IS NULL OR level = 1)",
    "ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS modulation VARCHAR(50) DEFAULT 'UNKNOWN'",
    "ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS bandwidth_hz DOUBLE PRECISION",
    "ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION DEFAULT 0.5",
    "ALTER TABLE rf_signals ADD COLUMN IF NOT EXISTS doa_deg DOUBLE PRECISION",
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS height_m DOUBLE PRECISION",
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS range_m DOUBLE PRECISION",
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS bearing_deg DOUBLE PRECISION",
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS fov_deg DOUBLE PRECISION",
    "ALTER TABLE jammer_profiles ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64)",
    "ALTER TABLE jammer_profiles ADD COLUMN IF NOT EXISTS port INTEGER",
    "UPDATE jammer_profiles SET ip_address = '127.0.0.1' WHERE ip_address IS NULL OR trim(ip_address) = ''",
    "UPDATE jammer_profiles SET port = 5001 WHERE port IS NULL",
    "ALTER TABLE jammer_profiles ALTER COLUMN ip_address SET NOT NULL",
    "ALTER TABLE jammer_profiles ALTER COLUMN port SET NOT NULL",
    """
    UPDATE assets
    SET type = CASE
        WHEN replace(upper(regexp_replace(trim(type), '[\\s-]+', '_', 'g')), '_', '') IN ('DF', 'DIRECTIONFINDER') THEN 'DIRECTION_FINDER'
        WHEN replace(upper(regexp_replace(trim(type), '[\\s-]+', '_', 'g')), '_', '') IN ('C2', 'C2NODE') THEN 'C2_NODE'
        WHEN replace(upper(regexp_replace(trim(type), '[\\s-]+', '_', 'g')), '_', '') = 'JAMMER' THEN 'JAMMER'
        ELSE upper(regexp_replace(trim(type), '[\\s-]+', '_', 'g'))
    END
    WHERE type IS NOT NULL AND trim(type) <> ''
    """,
    "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_name VARCHAR(255)",
    "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(100)",
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb",
    "UPDATE audit_logs SET details = '{}'::jsonb WHERE details IS NULL",
    "ALTER TABLE geospatial_ingestion_sources ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
    "UPDATE geospatial_ingestion_sources SET is_active = TRUE WHERE is_active IS NULL",
]


async def bootstrap_database(conn: AsyncConnection) -> None:
    await conn.run_sync(Base.metadata.create_all)
    await _apply_schema_patches(conn)


async def _apply_schema_patches(conn: AsyncConnection) -> None:
    for statement in SCHEMA_PATCH_STATEMENTS:
        await conn.execute(text(statement))
