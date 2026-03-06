import uuid
from typing import Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    token: str
    permissions: list[str] = []


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RoleRead(BaseModel):
    id: int
    name: str
    level: int

    model_config = ConfigDict(from_attributes=True)


class RoleCreate(BaseModel):
    name: str
    level: int = Field(default=1, ge=1)


class RoleUpdate(BaseModel):
    name: str
    level: int = Field(ge=1)


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role_id: int | None = None


class UserUpdate(BaseModel):
    username: str
    email: str
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
    alert_name: str | None = None
    alert_type: str | None = None
    severity: str
    status: str
    description: str | None = None
    acknowledged_by: uuid.UUID | None = None
    acknowledged_by_name: str | None = None
    acknowledged_at: datetime | None = None
    created_at: datetime | None = None
    latitude: float | None = None
    longitude: float | None = None

    model_config = ConfigDict(from_attributes=True)


class DecodioConfigUpdate(BaseModel):
    enabled: bool
    host: str
    port: int = Field(ge=1, le=65535)
    connect_timeout_seconds: float = Field(gt=0)
    read_timeout_seconds: float = Field(gt=0)
    heartbeat_interval_seconds: int = Field(gt=0)
    ack_timeout_seconds: float = Field(gt=0)
    reconnect_max_seconds: int = Field(gt=0)
    json_format: str = Field(default="auto")
    event_aliases: dict[str, list[str]] = Field(default_factory=dict)


class DecodioConfigRead(DecodioConfigUpdate):
    updated_at: datetime | None = None


class AlertAcknowledgeRequest(BaseModel):
    user_id: uuid.UUID


class GeospatialSourceRegisterRequest(BaseModel):
    source_name: str
    source_type: str
    transport: str = "API"
    classification: str = "UNCLASSIFIED"
    metadata: dict[str, Any] = Field(default_factory=dict)


class GeospatialSourceRead(BaseModel):
    source_id: str
    source_name: str
    source_type: str
    transport: str
    classification: str
    is_active: bool
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class GeospatialSourceUpdateRequest(BaseModel):
    source_name: str | None = None
    source_type: str | None = None
    transport: str | None = None
    classification: str | None = None
    metadata: dict[str, Any] | None = None


class CoordinateConvertRequest(BaseModel):
    source_system: str
    target_system: str
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    easting: float | None = None
    northing: float | None = None
    utm_zone: int | None = Field(default=None, ge=1, le=60)
    hemisphere: str | None = None
    mgrs: str | None = None


class CoordinateConvertResponse(BaseModel):
    source_system: str
    target_system: str
    result: dict[str, Any]


class AssetCreate(BaseModel):
    name: str
    type: str | None = None
    status: str = "ACTIVE"
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    height_m: float | None = Field(default=None, ge=0)
    range_m: float | None = Field(default=None, gt=0)
    bearing_deg: float | None = Field(default=None, ge=0, lt=360)
    fov_deg: float | None = Field(default=None, gt=0, le=360)


class AssetUpdate(BaseModel):
    name: str
    type: str | None = None
    status: str = "ACTIVE"
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    height_m: float | None = Field(default=None, ge=0)
    range_m: float | None = Field(default=None, gt=0)
    bearing_deg: float | None = Field(default=None, ge=0, lt=360)
    fov_deg: float | None = Field(default=None, gt=0, le=360)


class AssetRead(BaseModel):
    id: uuid.UUID
    name: str
    type: str | None = None
    status: str
    latitude: float
    longitude: float
    height_m: float | None = None
    range_m: float | None = None
    bearing_deg: float | None = None
    fov_deg: float | None = None
    df_radius_m: float | None = None
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


class AuditLogRead(BaseModel):
    id: int
    user_id: uuid.UUID | None = None
    action: str | None = None
    entity: str | None = None
    details: dict = {}
    timestamp: datetime | None = None
    username: str | None = None


class JammerProfileBase(BaseModel):
    asset_id: uuid.UUID

    manufacturer: str
    model_number: str
    variant_block: str | None = None
    serial_number: str
    asset_class: str = "JAMMER"
    jammer_subtype: str
    mission_domain: str
    lifecycle_state: str = "ACTIVE_SERVICE"

    dimensions_l_m: float | None = None
    dimensions_w_m: float | None = None
    dimensions_h_m: float | None = None
    weight_kg: float | None = None
    environmental_rating: str | None = None
    operating_temp_min_c: float | None = None
    operating_temp_max_c: float | None = None
    ingress_protection_rating: str | None = None

    platform_type: str
    mounting_configuration: str | None = None
    antenna_configuration: str | None = None
    vehicle_power_bus_type: str | None = None
    cooling_integration_type: str | None = None
    time_source_interface: str | None = None
    ip_address: str
    port: int = Field(ge=1, le=65535)

    rf_coverage_min_mhz: float
    rf_coverage_max_mhz: float
    max_effective_radiated_power_dbm: float | None = None
    simultaneous_channels_max: int | None = None
    waveform_family_support: list[str] = []
    modulation_support: list[str] = []
    geolocation_method_support: list[str] = []
    preset_technique_library_id: str | None = None

    input_voltage_min_v: float | None = None
    input_voltage_max_v: float | None = None
    nominal_power_draw_w: float | None = None
    peak_power_draw_w: float | None = None
    battery_backup_present: bool = False
    battery_backup_duration_min: int | None = None
    mtbf_hours: float | None = None
    built_in_test_level: str | None = None
    secure_boot_supported: bool = False
    tamper_detection_supported: bool = False

    c2_interface_profiles: list[str] = []
    ip_stack_support: list[str] = []
    message_bus_protocols: list[str] = []
    api_spec_version: str | None = None
    data_model_standard_refs: list[str] = []
    interoperability_cert_level: str | None = None

    spectrum_authorization_profile: str | None = None
    emissions_control_policy_id: str | None = None
    rules_of_employment_profile_id: str | None = None
    geofencing_policy_id: str | None = None
    legal_jurisdiction_tags: list[str] = []
    doctrinal_role_tags: list[str] = []

    security_classification: str
    crypto_module_type: str | None = None
    authn_methods_supported: list[str] = []
    authz_role_profile_id: str | None = None
    command_authorization_level: str | None = None
    data_at_rest_encryption: str | None = None
    data_in_transit_encryption: str | None = None
    audit_policy_id: str | None = None
    secure_logging_enabled: bool = True
    patch_baseline_version: str | None = None


class JammerProfileCreate(JammerProfileBase):
    pass


class JammerProfileUpdate(BaseModel):
    manufacturer: str | None = None
    model_number: str | None = None
    variant_block: str | None = None
    serial_number: str | None = None
    jammer_subtype: str | None = None
    mission_domain: str | None = None
    lifecycle_state: str | None = None

    dimensions_l_m: float | None = None
    dimensions_w_m: float | None = None
    dimensions_h_m: float | None = None
    weight_kg: float | None = None
    environmental_rating: str | None = None
    operating_temp_min_c: float | None = None
    operating_temp_max_c: float | None = None
    ingress_protection_rating: str | None = None

    platform_type: str | None = None
    mounting_configuration: str | None = None
    antenna_configuration: str | None = None
    vehicle_power_bus_type: str | None = None
    cooling_integration_type: str | None = None
    time_source_interface: str | None = None
    ip_address: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)

    rf_coverage_min_mhz: float | None = None
    rf_coverage_max_mhz: float | None = None
    max_effective_radiated_power_dbm: float | None = None
    simultaneous_channels_max: int | None = None
    waveform_family_support: list[str] | None = None
    modulation_support: list[str] | None = None
    geolocation_method_support: list[str] | None = None
    preset_technique_library_id: str | None = None

    input_voltage_min_v: float | None = None
    input_voltage_max_v: float | None = None
    nominal_power_draw_w: float | None = None
    peak_power_draw_w: float | None = None
    battery_backup_present: bool | None = None
    battery_backup_duration_min: int | None = None
    mtbf_hours: float | None = None
    built_in_test_level: str | None = None
    secure_boot_supported: bool | None = None
    tamper_detection_supported: bool | None = None

    c2_interface_profiles: list[str] | None = None
    ip_stack_support: list[str] | None = None
    message_bus_protocols: list[str] | None = None
    api_spec_version: str | None = None
    data_model_standard_refs: list[str] | None = None
    interoperability_cert_level: str | None = None

    spectrum_authorization_profile: str | None = None
    emissions_control_policy_id: str | None = None
    rules_of_employment_profile_id: str | None = None
    geofencing_policy_id: str | None = None
    legal_jurisdiction_tags: list[str] | None = None
    doctrinal_role_tags: list[str] | None = None

    security_classification: str | None = None
    crypto_module_type: str | None = None
    authn_methods_supported: list[str] | None = None
    authz_role_profile_id: str | None = None
    command_authorization_level: str | None = None
    data_at_rest_encryption: str | None = None
    data_in_transit_encryption: str | None = None
    audit_policy_id: str | None = None
    secure_logging_enabled: bool | None = None
    patch_baseline_version: str | None = None


class JammerProfileRead(JammerProfileBase):
    id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DirectionFinderProfileBase(BaseModel):
    asset_id: uuid.UUID

    manufacturer: str
    model_number: str
    variant_block: str | None = None
    serial_number: str
    platform_class: str
    mobility_class: str
    mission_domain: str
    lifecycle_state: str = "ACTIVE_SERVICE"

    antenna_array_type: str
    antenna_element_count: int | None = None
    antenna_polarization_support: list[str] = []
    receiver_channel_count: int | None = None
    sample_rate_max_sps: float | None = None
    frequency_reference_type: str | None = None
    frequency_reference_accuracy_ppb: float | None = None
    timing_holdover_seconds: int | None = None

    rf_min_mhz: float
    rf_max_mhz: float
    instantaneous_bandwidth_hz: float | None = None
    df_methods_supported: list[str] = []
    bearing_accuracy_deg_rms: float | None = None
    bearing_output_reference: str | None = None
    sensitivity_dbm: float | None = None
    dynamic_range_db: float | None = None
    calibration_profile_id: str | None = None

    deployment_mode: str | None = None
    site_id: str | None = None
    mount_height_agl_m: float | None = None
    sensor_boresight_offset_deg: float | None = None
    heading_alignment_offset_deg: float | None = None
    lever_arm_offset_m: dict[str, float] = {}
    geodetic_datum: str = "WGS84"
    altitude_reference: str = "MSL"
    survey_position_accuracy_m: float | None = None

    network_node_id: str | None = None
    primary_ipv4: str | None = None
    transport_protocols: list[str] = []
    message_protocols: list[str] = []
    data_format_profiles: list[str] = []
    time_sync_protocol: str | None = None
    ptp_profile: str | None = None
    api_version: str | None = None
    interoperability_profile: str | None = None

    security_classification: str
    releasability_marking: str | None = None
    authz_policy_id: str | None = None
    data_in_transit_encryption: str | None = None
    secure_boot_enabled: bool = True
    audit_policy_id: str | None = None

    firmware_version: str | None = None
    software_stack_version: str | None = None
    configuration_baseline_id: str | None = None
    calibration_due_date: str | None = None
    mtbf_hours: float | None = None
    maintenance_echelon: str | None = None

    @model_validator(mode="after")
    def validate_rf_range(self):
        if self.rf_min_mhz <= 0:
            raise ValueError("rf_min_mhz must be greater than 0")
        if self.rf_max_mhz <= 0:
            raise ValueError("rf_max_mhz must be greater than 0")
        if self.rf_max_mhz <= self.rf_min_mhz:
            raise ValueError("rf_max_mhz must be greater than rf_min_mhz")
        return self


class DirectionFinderProfileCreate(DirectionFinderProfileBase):
    pass


class DirectionFinderProfileUpdate(BaseModel):
    manufacturer: str | None = None
    model_number: str | None = None
    variant_block: str | None = None
    serial_number: str | None = None
    platform_class: str | None = None
    mobility_class: str | None = None
    mission_domain: str | None = None
    lifecycle_state: str | None = None

    antenna_array_type: str | None = None
    antenna_element_count: int | None = None
    antenna_polarization_support: list[str] | None = None
    receiver_channel_count: int | None = None
    sample_rate_max_sps: float | None = None
    frequency_reference_type: str | None = None
    frequency_reference_accuracy_ppb: float | None = None
    timing_holdover_seconds: int | None = None

    rf_min_mhz: float | None = None
    rf_max_mhz: float | None = None
    instantaneous_bandwidth_hz: float | None = None
    df_methods_supported: list[str] | None = None
    bearing_accuracy_deg_rms: float | None = None
    bearing_output_reference: str | None = None
    sensitivity_dbm: float | None = None
    dynamic_range_db: float | None = None
    calibration_profile_id: str | None = None

    deployment_mode: str | None = None
    site_id: str | None = None
    mount_height_agl_m: float | None = None
    sensor_boresight_offset_deg: float | None = None
    heading_alignment_offset_deg: float | None = None
    lever_arm_offset_m: dict[str, float] | None = None
    geodetic_datum: str | None = None
    altitude_reference: str | None = None
    survey_position_accuracy_m: float | None = None

    network_node_id: str | None = None
    primary_ipv4: str | None = None
    transport_protocols: list[str] | None = None
    message_protocols: list[str] | None = None
    data_format_profiles: list[str] | None = None
    time_sync_protocol: str | None = None
    ptp_profile: str | None = None
    api_version: str | None = None
    interoperability_profile: str | None = None

    security_classification: str | None = None
    releasability_marking: str | None = None
    authz_policy_id: str | None = None
    data_in_transit_encryption: str | None = None
    secure_boot_enabled: bool | None = None
    audit_policy_id: str | None = None

    firmware_version: str | None = None
    software_stack_version: str | None = None
    configuration_baseline_id: str | None = None
    calibration_due_date: str | None = None
    mtbf_hours: float | None = None
    maintenance_echelon: str | None = None

    @model_validator(mode="after")
    def validate_partial_rf_range(self):
        if self.rf_min_mhz is not None and self.rf_min_mhz <= 0:
            raise ValueError("rf_min_mhz must be greater than 0")
        if self.rf_max_mhz is not None and self.rf_max_mhz <= 0:
            raise ValueError("rf_max_mhz must be greater than 0")
        if (
            self.rf_min_mhz is not None
            and self.rf_max_mhz is not None
            and self.rf_max_mhz <= self.rf_min_mhz
        ):
            raise ValueError("rf_max_mhz must be greater than rf_min_mhz")
        return self


class DirectionFinderProfileRead(DirectionFinderProfileBase):
    id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SmsNodeConnectRequest(BaseModel):
    metrics: dict[str, Any] = Field(default_factory=dict)


class SmsNodeHealthRead(BaseModel):
    id: uuid.UUID
    source_node: str
    last_heartbeat: datetime
    online: bool
    metrics: dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SmsDetectionBase(BaseModel):
    source_node: str
    timestamp_utc: datetime
    frequency_hz: int = Field(gt=0)
    bandwidth_hz: int | None = Field(default=None, gt=0)
    power_dbm: float | None = None
    snr_db: float | None = None
    modulation: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    altitude_m: float | None = None

    doa_azimuth_deg: float | None = Field(default=None, ge=0.0, lt=360.0)
    doa_elevation_deg: float | None = Field(default=None, ge=-90.0, le=90.0)
    doa_rmse_deg: float | None = Field(default=None, ge=0.0)

    raw_payload: dict[str, Any] = Field(default_factory=dict)


class SmsDetectionCreate(SmsDetectionBase):
    pass


class SmsDetectionRead(SmsDetectionBase):
    id: uuid.UUID
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SmsTrackRead(BaseModel):
    id: uuid.UUID
    track_code: str
    first_seen: datetime
    last_seen: datetime
    frequency_min_hz: int
    frequency_max_hz: int
    avg_power_dbm: float | None = None
    mobility: str | None = None
    classification: str | None = None
    threat_level: int
    centroid_latitude: float | None = None
    centroid_longitude: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_json")
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SmsTrackClassifyRequest(BaseModel):
    classification: str = Field(min_length=1, max_length=128)
    threat_level: int | None = Field(default=None, ge=0, le=5)


class SmsThreatAckRequest(BaseModel):
    status: str = Field(default="ACK", min_length=2, max_length=32)


class SmsThreatRead(BaseModel):
    id: uuid.UUID
    track_id: uuid.UUID
    threat_type: str
    risk_score: float
    priority: str
    recommended_action: str | None = None
    status: str
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SmsSpectrumOccupancyBin(BaseModel):
    frequency_hz: int
    detection_count: int
    max_power_dbm: float | None = None


class TcpListenerHealthRead(BaseModel):
    enabled: bool
    running: bool
    host: str
    port: int
    active_connections: int
    total_connections: int
    messages_received: int
    messages_rejected: int
    idle_timeout_seconds: int
    max_line_bytes: int


class SmsAdapterIngestRequest(BaseModel):
    source_node: str
    detections: list[dict[str, Any]] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)


class SmsAdapterIngestResponse(BaseModel):
    accepted: int
    rejected: int
    errors: list[str] = Field(default_factory=list)
    node_health: SmsNodeHealthRead


class SmsAdapterHealthRead(BaseModel):
    running: bool
    queue_depth: int
    processed_messages: int
    accepted_detections: int
    rejected_detections: int
    last_message_at: datetime | None = None
    last_error: str | None = None
    nodes: list[dict[str, Any]] = Field(default_factory=list)


class CrfsStreamRead(BaseModel):
    stream_guid: str
    stream_name: str | None = None
    color: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CrfsSignalRead(BaseModel):
    id: int
    timestamp: datetime
    center_frequency: float | None = None
    bandwidth: float | None = None
    power: float | None = None
    snr: float | None = None
    modulation: str = "UNKNOWN"
    classification: str | None = None
    aoa_bearing: float | None = None
    aoa_elevation: float | None = None
    origin_guid: str
    stream_guid: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CrfsLocationRead(BaseModel):
    id: int
    latitude: float
    longitude: float
    altitude: float | None = None
    speed: float | None = None
    timestamp: datetime
    origin_guid: str
    stream_guid: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CrfsEventRead(BaseModel):
    id: int
    event_type: str
    frequency_center: float | None = None
    frequency_span: float | None = None
    power: float | None = None
    timestamp: datetime
    origin_guid: str
    stream_guid: str
    payload_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CrfsAlertRead(BaseModel):
    id: uuid.UUID
    alert_name: str | None = None
    alert_type: str | None = None
    severity: str
    status: str
    description: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CrfsIngestNodeCreate(BaseModel):
    node_name: str
    host: str
    port: int = Field(ge=1, le=65535)
    enabled: bool = True
    description: str | None = None


class CrfsIngestNodeUpdate(BaseModel):
    host: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    enabled: bool | None = None
    description: str | None = None


class CrfsIngestNodeRead(BaseModel):
    id: uuid.UUID
    node_name: str
    host: str
    port: int
    enabled: bool
    description: str | None = None
    last_seen: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CrfsIngestHealthRead(BaseModel):
    enabled: bool
    running: bool
    host: str
    port: int
    length_endian: str
    active_connections: int
    total_connections: int
    frames_received: int
    frames_processed: int
    frames_rejected: int
    frames_failed: int
    max_message_bytes: int
    idle_timeout_seconds: int
    last_message_at: datetime | None = None
    last_error: str | None = None
    realtime: dict[str, Any] = Field(default_factory=dict)


class CrfsIngestControlResponse(BaseModel):
    status: str
    health: CrfsIngestHealthRead


class CrfsOperatorDashboardRead(BaseModel):
    streams: list[CrfsStreamRead] = Field(default_factory=list)
    signals: list[CrfsSignalRead] = Field(default_factory=list)
    locations: list[CrfsLocationRead] = Field(default_factory=list)
    events: list[CrfsEventRead] = Field(default_factory=list)
    alerts: list[CrfsAlertRead] = Field(default_factory=list)
    realtime_events: list[dict[str, Any]] = Field(default_factory=list)