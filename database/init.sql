-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- =========================
-- ROLES TABLE
-- =========================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- =========================
-- USERS TABLE
-- =========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role_id INT REFERENCES roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- ASSETS TABLE (PostGIS)
-- =========================
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assets_location ON assets USING GIST (location);

-- =========================
-- JAMMER PROFILES TABLE
-- =========================
CREATE TABLE jammer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,

    manufacturer VARCHAR(255) NOT NULL,
    model_number VARCHAR(255) NOT NULL,
    variant_block VARCHAR(100),
    serial_number VARCHAR(255) NOT NULL UNIQUE,
    asset_class VARCHAR(50) NOT NULL DEFAULT 'JAMMER',
    jammer_subtype VARCHAR(100) NOT NULL,
    mission_domain VARCHAR(50) NOT NULL,
    lifecycle_state VARCHAR(100) NOT NULL DEFAULT 'ACTIVE_SERVICE',

    dimensions_l_m DOUBLE PRECISION,
    dimensions_w_m DOUBLE PRECISION,
    dimensions_h_m DOUBLE PRECISION,
    weight_kg DOUBLE PRECISION,
    environmental_rating VARCHAR(255),
    operating_temp_min_c DOUBLE PRECISION,
    operating_temp_max_c DOUBLE PRECISION,
    ingress_protection_rating VARCHAR(50),

    platform_type VARCHAR(100) NOT NULL,
    mounting_configuration VARCHAR(100),
    antenna_configuration VARCHAR(100),
    vehicle_power_bus_type VARCHAR(100),
    cooling_integration_type VARCHAR(100),
    time_source_interface VARCHAR(100),

    rf_coverage_min_mhz DOUBLE PRECISION NOT NULL,
    rf_coverage_max_mhz DOUBLE PRECISION NOT NULL,
    max_effective_radiated_power_dbm DOUBLE PRECISION,
    simultaneous_channels_max INTEGER,
    waveform_family_support JSONB DEFAULT '[]'::jsonb,
    modulation_support JSONB DEFAULT '[]'::jsonb,
    geolocation_method_support JSONB DEFAULT '[]'::jsonb,
    preset_technique_library_id VARCHAR(255),

    input_voltage_min_v DOUBLE PRECISION,
    input_voltage_max_v DOUBLE PRECISION,
    nominal_power_draw_w DOUBLE PRECISION,
    peak_power_draw_w DOUBLE PRECISION,
    battery_backup_present BOOLEAN DEFAULT FALSE,
    battery_backup_duration_min INTEGER,
    mtbf_hours DOUBLE PRECISION,
    built_in_test_level VARCHAR(100),
    secure_boot_supported BOOLEAN DEFAULT FALSE,
    tamper_detection_supported BOOLEAN DEFAULT FALSE,

    c2_interface_profiles JSONB DEFAULT '[]'::jsonb,
    ip_stack_support JSONB DEFAULT '[]'::jsonb,
    message_bus_protocols JSONB DEFAULT '[]'::jsonb,
    api_spec_version VARCHAR(100),
    data_model_standard_refs JSONB DEFAULT '[]'::jsonb,
    interoperability_cert_level VARCHAR(100),

    spectrum_authorization_profile VARCHAR(255),
    emissions_control_policy_id VARCHAR(255),
    rules_of_employment_profile_id VARCHAR(255),
    geofencing_policy_id VARCHAR(255),
    legal_jurisdiction_tags JSONB DEFAULT '[]'::jsonb,
    doctrinal_role_tags JSONB DEFAULT '[]'::jsonb,

    security_classification VARCHAR(50) NOT NULL,
    crypto_module_type VARCHAR(255),
    authn_methods_supported JSONB DEFAULT '[]'::jsonb,
    authz_role_profile_id VARCHAR(255),
    command_authorization_level VARCHAR(100),
    data_at_rest_encryption VARCHAR(100),
    data_in_transit_encryption VARCHAR(100),
    audit_policy_id VARCHAR(255),
    secure_logging_enabled BOOLEAN DEFAULT TRUE,
    patch_baseline_version VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jammer_profiles_asset_id ON jammer_profiles(asset_id);

-- =========================
-- DIRECTION FINDER PROFILES TABLE
-- =========================
CREATE TABLE direction_finder_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,

    manufacturer VARCHAR(255) NOT NULL,
    model_number VARCHAR(255) NOT NULL,
    variant_block VARCHAR(100),
    serial_number VARCHAR(255) NOT NULL UNIQUE,
    platform_class VARCHAR(100) NOT NULL,
    mobility_class VARCHAR(100) NOT NULL,
    mission_domain VARCHAR(50) NOT NULL,
    lifecycle_state VARCHAR(100) NOT NULL DEFAULT 'ACTIVE_SERVICE',

    antenna_array_type VARCHAR(100) NOT NULL,
    antenna_element_count INTEGER,
    antenna_polarization_support JSONB DEFAULT '[]'::jsonb,
    receiver_channel_count INTEGER,
    sample_rate_max_sps DOUBLE PRECISION,
    frequency_reference_type VARCHAR(100),
    frequency_reference_accuracy_ppb DOUBLE PRECISION,
    timing_holdover_seconds INTEGER,

    rf_min_mhz DOUBLE PRECISION NOT NULL,
    rf_max_mhz DOUBLE PRECISION NOT NULL,
    instantaneous_bandwidth_hz DOUBLE PRECISION,
    df_methods_supported JSONB DEFAULT '[]'::jsonb,
    bearing_accuracy_deg_rms DOUBLE PRECISION,
    bearing_output_reference VARCHAR(100),
    sensitivity_dbm DOUBLE PRECISION,
    dynamic_range_db DOUBLE PRECISION,
    calibration_profile_id VARCHAR(255),

    deployment_mode VARCHAR(100),
    site_id VARCHAR(255),
    mount_height_agl_m DOUBLE PRECISION,
    sensor_boresight_offset_deg DOUBLE PRECISION,
    heading_alignment_offset_deg DOUBLE PRECISION,
    lever_arm_offset_m JSONB DEFAULT '{}'::jsonb,
    geodetic_datum VARCHAR(50) DEFAULT 'WGS84',
    altitude_reference VARCHAR(50) DEFAULT 'MSL',
    survey_position_accuracy_m DOUBLE PRECISION,

    network_node_id VARCHAR(255),
    primary_ipv4 VARCHAR(64),
    transport_protocols JSONB DEFAULT '[]'::jsonb,
    message_protocols JSONB DEFAULT '[]'::jsonb,
    data_format_profiles JSONB DEFAULT '[]'::jsonb,
    time_sync_protocol VARCHAR(100),
    ptp_profile VARCHAR(100),
    api_version VARCHAR(100),
    interoperability_profile VARCHAR(255),

    security_classification VARCHAR(50) NOT NULL,
    releasability_marking VARCHAR(255),
    authz_policy_id VARCHAR(255),
    data_in_transit_encryption VARCHAR(100),
    secure_boot_enabled BOOLEAN DEFAULT TRUE,
    audit_policy_id VARCHAR(255),

    firmware_version VARCHAR(100),
    software_stack_version VARCHAR(100),
    configuration_baseline_id VARCHAR(255),
    calibration_due_date VARCHAR(50),
    mtbf_hours DOUBLE PRECISION,
    maintenance_echelon VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_direction_finder_profiles_asset_id ON direction_finder_profiles(asset_id);

-- =========================
-- SMS NODE HEALTH TABLE
-- =========================
CREATE TABLE sms_node_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node VARCHAR(100) NOT NULL UNIQUE,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    online BOOLEAN NOT NULL DEFAULT FALSE,
    metrics JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_node_health_source_node ON sms_node_health(source_node);

-- =========================
-- SMS DETECTIONS TABLE
-- =========================
CREATE TABLE sms_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node VARCHAR(100) NOT NULL,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    frequency_hz BIGINT NOT NULL,
    bandwidth_hz INTEGER,
    power_dbm DOUBLE PRECISION,
    snr_db DOUBLE PRECISION,
    modulation VARCHAR(100),
    confidence DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude_m DOUBLE PRECISION,
    doa_azimuth_deg DOUBLE PRECISION,
    doa_elevation_deg DOUBLE PRECISION,
    doa_rmse_deg DOUBLE PRECISION,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_detections_source_node ON sms_detections(source_node);
CREATE INDEX idx_sms_detections_timestamp_utc ON sms_detections(timestamp_utc);
CREATE INDEX idx_sms_detections_frequency_hz ON sms_detections(frequency_hz);

-- =========================
-- SMS TRACKS TABLE
-- =========================
CREATE TABLE sms_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_code VARCHAR(100) NOT NULL UNIQUE,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    frequency_min_hz BIGINT NOT NULL,
    frequency_max_hz BIGINT NOT NULL,
    avg_power_dbm DOUBLE PRECISION,
    mobility VARCHAR(50),
    classification VARCHAR(255),
    threat_level INTEGER NOT NULL DEFAULT 0,
    centroid_latitude DOUBLE PRECISION,
    centroid_longitude DOUBLE PRECISION,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_tracks_last_seen ON sms_tracks(last_seen);

-- =========================
-- SMS THREATS TABLE
-- =========================
CREATE TABLE sms_threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES sms_tracks(id) ON DELETE CASCADE,
    threat_type VARCHAR(255) NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    priority VARCHAR(20) NOT NULL DEFAULT 'LOW',
    recommended_action TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_threats_track_id ON sms_threats(track_id);
CREATE INDEX idx_sms_threats_priority ON sms_threats(priority);
CREATE INDEX idx_sms_threats_status ON sms_threats(status);

-- =========================
-- ALERTS TABLE
-- =========================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'NEW',
    description TEXT,
    location GEOGRAPHY(POINT, 4326),
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_location ON alerts USING GIST (location);
CREATE INDEX idx_alerts_status ON alerts(status);

-- =========================
-- RF SIGNALS (Partitioned)
-- =========================
CREATE TABLE rf_signals (
    id BIGSERIAL,
    frequency DOUBLE PRECISION NOT NULL,
    power_level DOUBLE PRECISION NOT NULL,
    modulation VARCHAR(50) DEFAULT 'UNKNOWN',
    bandwidth_hz DOUBLE PRECISION,
    confidence DOUBLE PRECISION DEFAULT 0.5,
    doa_deg DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326),
    detected_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, detected_at)
) PARTITION BY RANGE (detected_at);

-- Monthly partition example
CREATE TABLE rf_signals_2026_01 PARTITION OF rf_signals
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE INDEX idx_rf_location_2026_01
ON rf_signals_2026_01
USING GIST (location);

-- =========================
-- AUDIT LOG TABLE
-- =========================
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(255),
    entity VARCHAR(100),
    entity_id UUID,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);