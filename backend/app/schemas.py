import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    token: str


class RoleRead(BaseModel):
    id: int
    name: str
    level: int

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role_id: int | None = None


class UserRead(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    is_active: bool
    role_id: int | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PermissionCreate(BaseModel):
    resource: str
    action: str
    scope: str = "GLOBAL"


class PermissionRead(BaseModel):
    id: int
    resource: str
    action: str
    scope: str

    model_config = ConfigDict(from_attributes=True)


class RolePermissionAssign(BaseModel):
    permission_id: int


class RoleInheritanceCreate(BaseModel):
    parent_role_id: int
    child_role_id: int


class AlertRead(BaseModel):
    id: uuid.UUID
    asset_id: uuid.UUID | None = None
    severity: str
    status: str
    description: str | None = None
    acknowledged_by: uuid.UUID | None = None
    acknowledged_at: datetime | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AlertAcknowledgeRequest(BaseModel):
    user_id: uuid.UUID


class AssetCreate(BaseModel):
    name: str
    type: str | None = None
    status: str = "ACTIVE"
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class AssetRead(BaseModel):
    id: uuid.UUID
    name: str
    type: str | None = None
    status: str
    latitude: float
    longitude: float
    created_at: datetime | None = None


class RFSignalCreate(BaseModel):
    frequency: float
    modulation: str = "UNKNOWN"
    power_level: float
    bandwidth_hz: float | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    doa_deg: float | None = Field(default=None, ge=0.0, lt=360.0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    detected_at: datetime


class RFSignalRead(BaseModel):
    id: int
    frequency: float
    modulation: str
    power_level: float
    bandwidth_hz: float | None = None
    confidence: float
    doa_deg: float | None = None
    latitude: float
    longitude: float
    detected_at: datetime


class HeatMapCell(BaseModel):
    latitude_bucket: float
    longitude_bucket: float
    density: int


class TriangulationPoint(BaseModel):
    latitude: float
    longitude: float


class TriangulationRay(BaseModel):
    source_id: str
    source_latitude: float
    source_longitude: float
    bearing_deg: float
    end_latitude: float
    end_longitude: float
    confidence: float


class TriangulationResponse(BaseModel):
    antenna_count: int
    intersection_count: int
    centroid_latitude: float | None = None
    centroid_longitude: float | None = None
    roi_polygon: list[TriangulationPoint] = []
    rays: list[TriangulationRay] = []
    warning: str | None = None


class StatisticalReportRequest(BaseModel):
    period_start: datetime
    period_end: datetime


class StatisticalReportResponse(BaseModel):
    total_signals: int
    unique_modulations: int
    avg_power: float | None = None
    max_frequency: float | None = None


class EOBRequest(BaseModel):
    period_start: datetime
    period_end: datetime
    eob_type: str = "LEOB"


class EOBEntryRead(BaseModel):
    emitter_designation: str
    assessed_capability: str
    threat_level: str
    confidence: float


class CoverageSimulationRequest(BaseModel):
    scenario_name: str
    model_name: str = "FreeSpace"
    center_latitude: float = Field(ge=-90, le=90)
    center_longitude: float = Field(ge=-180, le=180)
    radius_km: float = Field(gt=0)
    transmit_power_dbm: float
    frequency_mhz: float


class CoveragePoint(BaseModel):
    latitude: float
    longitude: float
    coverage_db: float


class CoverageSimulationResponse(BaseModel):
    scenario_name: str
    model_name: str
    points: list[CoveragePoint]