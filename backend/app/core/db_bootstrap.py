import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.config import settings
from app.core.security import hash_password
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
    "UPDATE users SET role_id = COALESCE((SELECT id FROM roles WHERE name = 'OPERATOR' LIMIT 1), (SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1)) WHERE role_id IS NULL",
    "ALTER TABLE users ALTER COLUMN role_id SET NOT NULL",
    "INSERT INTO permissions (resource, action, scope) VALUES ('assets','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('assets','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('rf','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('rf','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('sms','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('sms','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('sms_threat','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('sms_threat','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('tcp_listener','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('tcp_listener','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('telecom','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('telecom','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('users','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('users','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('roles','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('roles','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('permissions','read','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO permissions (resource, action, scope) VALUES ('permissions','write','GLOBAL') ON CONFLICT (resource, action) DO NOTHING",
    "INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r JOIN permissions p ON r.name = 'ADMIN' AND (p.resource, p.action) IN (('assets','read'),('assets','write'),('rf','read'),('rf','write'),('sms','read'),('sms','write'),('sms_threat','read'),('sms_threat','write'),('tcp_listener','read'),('tcp_listener','write'),('telecom','read'),('telecom','write'),('users','read'),('users','write'),('roles','read'),('roles','write'),('permissions','read'),('permissions','write')) ON CONFLICT (role_id, permission_id) DO NOTHING",
    "INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r JOIN permissions p ON r.name = 'OPERATOR' AND (p.resource, p.action) IN (('assets','read'),('rf','read'),('sms','read'),('sms','write'),('sms_threat','read'),('sms_threat','write'),('tcp_listener','read'),('tcp_listener','write'),('telecom','read')) ON CONFLICT (role_id, permission_id) DO NOTHING",
]


async def bootstrap_database(conn: AsyncConnection) -> None:
    await conn.run_sync(Base.metadata.create_all)
    await _apply_schema_patches(conn)
    await _bootstrap_base_roles(conn)
    await _bootstrap_admin_user(conn)
    await _bootstrap_operator_user(conn)


async def _apply_schema_patches(conn: AsyncConnection) -> None:
    for statement in SCHEMA_PATCH_STATEMENTS:
        await conn.execute(text(statement))


async def _bootstrap_admin_user(conn: AsyncConnection) -> None:
    username = (settings.ADMIN_BOOTSTRAP_USERNAME or "").strip()
    password = settings.ADMIN_BOOTSTRAP_PASSWORD or ""
    email = (settings.ADMIN_BOOTSTRAP_EMAIL or "").strip()

    if not username or not password:
        return

    if not email:
        email = f"{username}@c2.local"

    admin_role_row = await conn.execute(text("SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1"))
    admin_role_id = admin_role_row.scalar_one_or_none()
    if admin_role_id is None:
        return

    existing_user_row = await conn.execute(
        text(
            """
            SELECT id
            FROM users
            WHERE username = :username OR email = :email
            LIMIT 1
            """
        ),
        {"username": username, "email": email},
    )
    if existing_user_row.scalar_one_or_none() is not None:
        return

    await conn.execute(
        text(
            """
            INSERT INTO users (id, username, email, hashed_password, role_id)
            VALUES (:id, :username, :email, :hashed_password, :role_id)
            """
        ),
        {
            "id": uuid.uuid4(),
            "username": username,
            "email": email,
            "hashed_password": hash_password(password),
            "role_id": admin_role_id,
        },
    )


async def _bootstrap_base_roles(conn: AsyncConnection) -> None:
    await conn.execute(
        text("INSERT INTO roles (name) VALUES ('ADMIN') ON CONFLICT (name) DO NOTHING")
    )
    await conn.execute(
        text(
            "INSERT INTO roles (name) VALUES ('OPERATOR') ON CONFLICT (name) DO NOTHING"
        )
    )


async def _bootstrap_operator_user(conn: AsyncConnection) -> None:
    username = (settings.OPERATOR_BOOTSTRAP_USERNAME or "").strip() or "operator"
    password = settings.OPERATOR_BOOTSTRAP_PASSWORD or "password"
    email = (settings.OPERATOR_BOOTSTRAP_EMAIL or "").strip() or "operator@c2.local"

    is_development = (settings.ENVIRONMENT or "").lower() == "development"
    if not is_development and settings.OPERATOR_BOOTSTRAP_PASSWORD is None:
        return

    operator_role_row = await conn.execute(
        text("SELECT id FROM roles WHERE name = 'OPERATOR' LIMIT 1")
    )
    operator_role_id = operator_role_row.scalar_one_or_none()
    if operator_role_id is None:
        return

    existing_user_row = await conn.execute(
        text(
            """
            SELECT id
            FROM users
            WHERE username = :username OR email = :email
            LIMIT 1
            """
        ),
        {"username": username, "email": email},
    )
    if existing_user_row.scalar_one_or_none() is not None:
        return

    await conn.execute(
        text(
            """
            INSERT INTO users (id, username, email, hashed_password, role_id)
            VALUES (:id, :username, :email, :hashed_password, :role_id)
            """
        ),
        {
            "id": uuid.uuid4(),
            "username": username,
            "email": email,
            "hashed_password": hash_password(password),
            "role_id": operator_role_id,
        },
    )
