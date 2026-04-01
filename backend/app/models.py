import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Text, TIMESTAMP, func, Integer, BigInteger, Float, Table, UniqueConstraint, Index
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
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    acknowledged_alerts = relationship("Alert", back_populates="acknowledger")
    audit_logs = relationship("AuditLog", back_populates="user")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    used_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="password_reset_tokens")


class Asset(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    type = Column(String)
    status = Column(String)
    location = Column(Geography("POINT", srid=4326))
    height_m = Column(Float)
    range_m = Column(Float)
    bearing_deg = Column(Float)
    fov_deg = Column(Float)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    alerts = relationship("Alert", back_populates="asset")
    jammer_profile = relationship("JammerProfile", back_populates="asset", uselist=False)
    direction_finder_profile = relationship("DirectionFinderProfile", back_populates="asset", uselist=False)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"))
    alert_name = Column(String)
    alert_type = Column(String)
    severity = Column(String)
    status = Column(String, default="NEW")
    description = Column(Text)
    location = Column(Geography("POINT", srid=4326))
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    acknowledged_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="alerts")
    acknowledger = relationship("User", back_populates="acknowledged_alerts")


class DecodioApiConfig(Base):
    __tablename__ = "decodio_api_config"

    id = Column(Integer, primary_key=True, default=1)
    enabled = Column(Boolean, default=False, nullable=False)
    host = Column(String, nullable=False, default="127.0.0.1")
    port = Column(Integer, nullable=False, default=9100)
    connect_timeout_seconds = Column(Float, nullable=False, default=5.0)
    read_timeout_seconds = Column(Float, nullable=False, default=45.0)
    heartbeat_interval_seconds = Column(Integer, nullable=False, default=15)
    ack_timeout_seconds = Column(Float, nullable=False, default=8.0)
    reconnect_max_seconds = Column(Integer, nullable=False, default=60)
    json_format = Column(String, nullable=False, default="auto")
    event_aliases = Column(JSONB, default=dict)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class JammerProfile(Base):
    __tablename__ = "jammer_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False, unique=True)

    manufacturer = Column(String, nullable=False)
    model_number = Column(String, nullable=False)
    variant_block = Column(String)
    serial_number = Column(String, nullable=False, unique=True)
    asset_class = Column(String, nullable=False, default="JAMMER")
    jammer_subtype = Column(String, nullable=False)
    mission_domain = Column(String, nullable=False)
    lifecycle_state = Column(String, nullable=False, default="ACTIVE_SERVICE")

    dimensions_l_m = Column(Float)
    dimensions_w_m = Column(Float)
    dimensions_h_m = Column(Float)
    weight_kg = Column(Float)
    environmental_rating = Column(String)
    operating_temp_min_c = Column(Float)
    operating_temp_max_c = Column(Float)
    ingress_protection_rating = Column(String)

    platform_type = Column(String, nullable=False)
    mounting_configuration = Column(String)
    antenna_configuration = Column(String)
    vehicle_power_bus_type = Column(String)
    cooling_integration_type = Column(String)
    time_source_interface = Column(String)
    ip_address = Column(String, nullable=False)
    port = Column(Integer, nullable=False)

    rf_coverage_min_mhz = Column(Float, nullable=False)
    rf_coverage_max_mhz = Column(Float, nullable=False)
    max_effective_radiated_power_dbm = Column(Float)
    simultaneous_channels_max = Column(Integer)
    waveform_family_support = Column(JSONB, default=list)
    modulation_support = Column(JSONB, default=list)
    geolocation_method_support = Column(JSONB, default=list)
    preset_technique_library_id = Column(String)

    input_voltage_min_v = Column(Float)
    input_voltage_max_v = Column(Float)
    nominal_power_draw_w = Column(Float)
    peak_power_draw_w = Column(Float)
    battery_backup_present = Column(Boolean, default=False)
    battery_backup_duration_min = Column(Integer)
    mtbf_hours = Column(Float)
    built_in_test_level = Column(String)
    secure_boot_supported = Column(Boolean, default=False)
    tamper_detection_supported = Column(Boolean, default=False)

    c2_interface_profiles = Column(JSONB, default=list)
    ip_stack_support = Column(JSONB, default=list)
    message_bus_protocols = Column(JSONB, default=list)
    api_spec_version = Column(String)
    data_model_standard_refs = Column(JSONB, default=list)
    interoperability_cert_level = Column(String)

    spectrum_authorization_profile = Column(String)
    emissions_control_policy_id = Column(String)
    rules_of_employment_profile_id = Column(String)
    geofencing_policy_id = Column(String)
    legal_jurisdiction_tags = Column(JSONB, default=list)
    doctrinal_role_tags = Column(JSONB, default=list)

    security_classification = Column(String, nullable=False)
    crypto_module_type = Column(String)
    authn_methods_supported = Column(JSONB, default=list)
    authz_role_profile_id = Column(String)
    command_authorization_level = Column(String)
    data_at_rest_encryption = Column(String)
    data_in_transit_encryption = Column(String)
    audit_policy_id = Column(String)
    secure_logging_enabled = Column(Boolean, default=True)
    patch_baseline_version = Column(String)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    asset = relationship("Asset", back_populates="jammer_profile")


class DirectionFinderProfile(Base):
    __tablename__ = "direction_finder_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False, unique=True)

    manufacturer = Column(String, nullable=False)
    model_number = Column(String, nullable=False)
    variant_block = Column(String)
    serial_number = Column(String, nullable=False, unique=True)
    platform_class = Column(String, nullable=False)
    mobility_class = Column(String, nullable=False)
    mission_domain = Column(String, nullable=False)
    lifecycle_state = Column(String, nullable=False, default="ACTIVE_SERVICE")

    antenna_array_type = Column(String, nullable=False)
    antenna_element_count = Column(Integer)
    antenna_polarization_support = Column(JSONB, default=list)
    receiver_channel_count = Column(Integer)
    sample_rate_max_sps = Column(Float)
    frequency_reference_type = Column(String)
    frequency_reference_accuracy_ppb = Column(Float)
    timing_holdover_seconds = Column(Integer)

    rf_min_mhz = Column(Float, nullable=False)
    rf_max_mhz = Column(Float, nullable=False)
    instantaneous_bandwidth_hz = Column(Float)
    df_methods_supported = Column(JSONB, default=list)
    bearing_accuracy_deg_rms = Column(Float)
    bearing_output_reference = Column(String)
    sensitivity_dbm = Column(Float)
    dynamic_range_db = Column(Float)
    calibration_profile_id = Column(String)

    deployment_mode = Column(String)
    site_id = Column(String)
    mount_height_agl_m = Column(Float)
    sensor_boresight_offset_deg = Column(Float)
    heading_alignment_offset_deg = Column(Float)
    lever_arm_offset_m = Column(JSONB, default=dict)
    geodetic_datum = Column(String, default="WGS84")
    altitude_reference = Column(String, default="MSL")
    survey_position_accuracy_m = Column(Float)

    network_node_id = Column(String)
    primary_ipv4 = Column(String)
    transport_protocols = Column(JSONB, default=list)
    message_protocols = Column(JSONB, default=list)
    data_format_profiles = Column(JSONB, default=list)
    time_sync_protocol = Column(String)
    ptp_profile = Column(String)
    api_version = Column(String)
    interoperability_profile = Column(String)

    security_classification = Column(String, nullable=False)
    releasability_marking = Column(String)
    authz_policy_id = Column(String)
    data_in_transit_encryption = Column(String)
    secure_boot_enabled = Column(Boolean, default=True)
    audit_policy_id = Column(String)

    firmware_version = Column(String)
    software_stack_version = Column(String)
    configuration_baseline_id = Column(String)
    calibration_due_date = Column(String)
    mtbf_hours = Column(Float)
    maintenance_echelon = Column(String)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    asset = relationship("Asset", back_populates="direction_finder_profile")


class SmsDetection(Base):
    __tablename__ = "sms_detections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_node = Column(String, nullable=False, index=True)
    timestamp_utc = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    frequency_hz = Column(BigInteger, nullable=False, index=True)
    bandwidth_hz = Column(Integer)
    power_dbm = Column(Float)
    snr_db = Column(Float)
    modulation = Column(String)
    confidence = Column(Float)

    latitude = Column(Float)
    longitude = Column(Float)
    altitude_m = Column(Float)

    doa_azimuth_deg = Column(Float)
    doa_elevation_deg = Column(Float)
    doa_rmse_deg = Column(Float)

    raw_payload = Column(JSONB, default=dict)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class SmsTrack(Base):
    __tablename__ = "sms_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_code = Column(String, nullable=False, unique=True, index=True)
    first_seen = Column(TIMESTAMP(timezone=True), nullable=False)
    last_seen = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    frequency_min_hz = Column(BigInteger, nullable=False)
    frequency_max_hz = Column(BigInteger, nullable=False)
    avg_power_dbm = Column(Float)
    mobility = Column(String)
    classification = Column(String)
    threat_level = Column(Integer, nullable=False, default=0)
    centroid_latitude = Column(Float)
    centroid_longitude = Column(Float)
    metadata_json = Column("metadata", JSONB, default=dict)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    threats = relationship("SmsThreat", back_populates="track")


class SmsThreat(Base):
    __tablename__ = "sms_threats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id = Column(UUID(as_uuid=True), ForeignKey("sms_tracks.id"), nullable=False, index=True)
    threat_type = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False, default=0.0)
    priority = Column(String, nullable=False, default="LOW")
    recommended_action = Column(Text)
    status = Column(String, nullable=False, default="OPEN")
    details = Column(JSONB, default=dict)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    track = relationship("SmsTrack", back_populates="threats")


class SmsNodeHealth(Base):
    __tablename__ = "sms_node_health"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_node = Column(String, nullable=False, unique=True, index=True)
    last_heartbeat = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    online = Column(Boolean, nullable=False, default=False)
    metrics = Column(JSONB, default=dict)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class GeospatialIngestionSource(Base):
    __tablename__ = "geospatial_ingestion_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_name = Column(String, nullable=False, unique=True, index=True)
    source_type = Column(String, nullable=False)
    transport = Column(String, nullable=False, default="API")
    classification = Column(String, nullable=False, default="UNCLASSIFIED")
    is_active = Column(Boolean, nullable=False, default=True)
    metadata_json = Column("metadata", JSONB, default=dict)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


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


class CrfsStream(Base):
    __tablename__ = "crfs_streams"

    stream_guid = Column(String, primary_key=True)
    stream_name = Column(String, nullable=True)
    color = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class CrfsSignal(Base):
    __tablename__ = "crfs_signals"
    __table_args__ = (
        Index("ix_crfs_signals_timestamp", "timestamp"),
        Index("ix_crfs_signals_stream_guid", "stream_guid"),
        Index("ix_crfs_signals_origin_guid", "origin_guid"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    center_frequency = Column(Float)
    bandwidth = Column(Float)
    power = Column(Float)
    snr = Column(Float)
    modulation = Column(String, default="UNKNOWN")
    classification = Column(String)
    aoa_bearing = Column(Float)
    aoa_elevation = Column(Float)
    origin_guid = Column(String, nullable=False)
    stream_guid = Column(String, ForeignKey("crfs_streams.stream_guid"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class CrfsLocation(Base):
    __tablename__ = "crfs_locations"
    __table_args__ = (
        Index("ix_crfs_locations_timestamp", "timestamp"),
        Index("ix_crfs_locations_stream_guid", "stream_guid"),
        Index("ix_crfs_locations_origin_guid", "origin_guid"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude = Column(Float)
    speed = Column(Float)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    origin_guid = Column(String, nullable=False)
    stream_guid = Column(String, ForeignKey("crfs_streams.stream_guid"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class CrfsEvent(Base):
    __tablename__ = "crfs_events"
    __table_args__ = (
        Index("ix_crfs_events_timestamp", "timestamp"),
        Index("ix_crfs_events_event_type", "event_type"),
        Index("ix_crfs_events_stream_guid", "stream_guid"),
        Index("ix_crfs_events_origin_guid", "origin_guid"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False)
    frequency_center = Column(Float)
    frequency_span = Column(Float)
    power = Column(Float)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    origin_guid = Column(String, nullable=False)
    stream_guid = Column(String, ForeignKey("crfs_streams.stream_guid"), nullable=False)
    payload_json = Column("payload", JSONB, default=dict)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class CrfsIngestNode(Base):
    __tablename__ = "crfs_ingest_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_name = Column(String, nullable=False, unique=True, index=True)
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    description = Column(String)
    last_seen = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


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


class RFDataModel(Base):
    __tablename__ = "rf_data"

    id = Column(Integer, primary_key=True, index=True)
    freq = Column(Float)
    power = Column(Float)
    snr = Column(Float)
    lat = Column(Float)
    lon = Column(Float)


class CdrRecord(Base):
    """Call Detail Record — one row per call/SMS/data session."""
    __tablename__ = "cdr_records"
    __table_args__ = (
        Index("ix_cdr_records_msisdn", "msisdn"),
        Index("ix_cdr_records_start_time", "start_time"),
        Index("ix_cdr_records_network", "network"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    msisdn = Column(String, nullable=False)
    imsi = Column(String)
    imei = Column(String)
    target = Column(String)
    call_type = Column(String, nullable=False)   # Voice / SMS / Data
    operator = Column(String)
    network = Column(String)                     # 5G / 4G / LTE / 3G
    band = Column(String)
    ran = Column(String)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    start_time = Column(TIMESTAMP(timezone=True), nullable=False)
    end_time = Column(TIMESTAMP(timezone=True))
    duration_sec = Column(Integer, default=0)
    is_fake = Column(Boolean, default=False)
    silent_call_type = Column(String, default="None")
    place = Column(String)
    country = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class SignalLog(Base):
    """Signal capture log — one row per detected device scan event."""
    __tablename__ = "signal_logs"
    __table_args__ = (
        Index("ix_signal_logs_imsi", "imsi"),
        Index("ix_signal_logs_detected_at", "detected_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    imsi = Column(String, nullable=False)
    imei = Column(String)
    msisdn = Column(String)
    operator = Column(String)
    network = Column(String)
    band = Column(String)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    signal_dbm = Column(Float)                   # e.g. -85.0
    signal_strength = Column(String)             # Strong / Medium / Weak
    status = Column(String, default="Active")    # Active / Idle
    is_intercepted = Column(Boolean, default=False)
    is_fake = Column(Boolean, default=False)
    detected_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
