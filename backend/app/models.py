import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Text, TIMESTAMP, func, Integer, BigInteger, Float, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from app.database import Base


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


role_inheritance = Table(
    "role_inheritance",
    Base.metadata,
    Column("parent_role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("child_role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    level = Column(Integer, default=1)
    users = relationship("User", back_populates="role")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("resource", "action", name="uq_permissions_resource_action"),)

    id = Column(Integer, primary_key=True, index=True)
    resource = Column(String, nullable=False)
    action = Column(String, nullable=False)
    scope = Column(String, default="GLOBAL")
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True)
    email = Column(String, unique=True)
    hashed_password = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role", back_populates="users")
    acknowledged_alerts = relationship("Alert", back_populates="acknowledger")
    audit_logs = relationship("AuditLog", back_populates="user")


class Asset(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    type = Column(String)
    status = Column(String)
    location = Column(Geography("POINT", srid=4326))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    alerts = relationship("Alert", back_populates="asset")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"))
    severity = Column(String)
    status = Column(String, default="NEW")
    description = Column(Text)
    location = Column(Geography("POINT", srid=4326))
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    acknowledged_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="alerts")
    acknowledger = relationship("User", back_populates="acknowledged_alerts")


class RFSignal(Base):
    __tablename__ = "rf_signals"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    frequency = Column(Float, nullable=False)
    modulation = Column(String, default="UNKNOWN")
    power_level = Column(Float, nullable=False)
    bandwidth_hz = Column(Float)
    confidence = Column(Float, default=0.5)
    doa_deg = Column(Float)
    location = Column(Geography("POINT", srid=4326))
    detected_at = Column(TIMESTAMP(timezone=True), primary_key=True, nullable=False)


class CoverageRun(Base):
    __tablename__ = "coverage_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_name = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    parameters = Column(JSONB, default=dict)
    status = Column(String, default="PENDING")
    initiated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    started_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    completed_at = Column(TIMESTAMP(timezone=True))


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_type = Column(String, nullable=False)
    period_start = Column(TIMESTAMP(timezone=True))
    period_end = Column(TIMESTAMP(timezone=True))
    parameters = Column(JSONB, default=dict)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    generated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    artifact_uri = Column(String)


class EOBEntry(Base):
    __tablename__ = "eob_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    eob_type = Column(String, nullable=False)
    emitter_designation = Column(String, nullable=False)
    assessed_capability = Column(String, nullable=False)
    threat_level = Column(String, nullable=False)
    confidence = Column(Float, default=0.5)
    generated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String)
    entity = Column(String)
    entity_id = Column(UUID(as_uuid=True))
    details = Column(JSONB, default=dict)
    timestamp = Column(TIMESTAMP(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")