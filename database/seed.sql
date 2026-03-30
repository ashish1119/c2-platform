INSERT INTO roles (name) VALUES
('ADMIN'),
('OPERATOR');

INSERT INTO permissions (resource, action, scope) VALUES
('decodio', 'read', 'GLOBAL'),
('decodio', 'write', 'GLOBAL'),
('audit', 'read', 'GLOBAL'),
('jammer', 'read', 'GLOBAL'),
('jammer', 'write', 'GLOBAL'),
('direction_finder', 'read', 'GLOBAL'),
('direction_finder', 'write', 'GLOBAL'),
('sms', 'read', 'GLOBAL'),
('sms', 'write', 'GLOBAL'),
('sms_threat', 'read', 'GLOBAL'),
('sms_threat', 'write', 'GLOBAL'),
('geospatial', 'read', 'GLOBAL'),
('geospatial', 'write', 'GLOBAL'),
('crfs', 'read', 'GLOBAL'),
('crfs', 'write', 'GLOBAL'),
('crfs', 'replay', 'GLOBAL'),
('assets', 'read', 'GLOBAL'),
('assets', 'write', 'GLOBAL'),
('rf', 'read', 'GLOBAL'),
('rf', 'write', 'GLOBAL'),
('telecom', 'read', 'GLOBAL'),
('telecom', 'write', 'GLOBAL'),
('users', 'read', 'GLOBAL'),
('users', 'write', 'GLOBAL'),
('roles', 'read', 'GLOBAL'),
('roles', 'write', 'GLOBAL'),
('permissions', 'read', 'GLOBAL'),
('permissions', 'write', 'GLOBAL'),
('tcp_listener', 'read', 'GLOBAL'),
('tcp_listener', 'write', 'GLOBAL')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON (
        (r.name = 'ADMIN' AND (p.resource, p.action) IN (
            ('decodio', 'read'),
            ('decodio', 'write'),
            ('audit', 'read'),
            ('jammer', 'read'),
            ('jammer', 'write'),
            ('direction_finder', 'read'),
            ('direction_finder', 'write'),
            ('sms', 'read'),
            ('sms', 'write'),
            ('sms_threat', 'read'),
            ('sms_threat', 'write'),
            ('geospatial', 'read'),
            ('geospatial', 'write'),
            ('crfs', 'read'),
            ('crfs', 'write'),
            ('crfs', 'replay'),
            ('assets', 'read'),
            ('assets', 'write'),
            ('rf', 'read'),
            ('rf', 'write'),
            ('telecom', 'read'),
            ('telecom', 'write'),
            ('users', 'read'),
            ('users', 'write'),
            ('roles', 'read'),
            ('roles', 'write'),
            ('permissions', 'read'),
            ('permissions', 'write'),
            ('tcp_listener', 'read'),
            ('tcp_listener', 'write')
        ))
        OR
        (r.name = 'OPERATOR' AND (p.resource, p.action) IN (
            ('assets', 'read'),
            ('rf', 'read'),
            ('telecom', 'read'),
            ('crfs', 'read'),
            ('tcp_listener', 'read'),
            ('tcp_listener', 'write'),
            ('sms', 'read'),
            ('sms', 'write'),
            ('direction_finder', 'read')
        ))
    )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO users (username, email, hashed_password, role_id)
VALUES (
    'admin',
    'admin@c2.local',
    -- '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7nZ9YjRzCQXDpUe1koRaSPo6e7iT730', -- password: password
    '$2b$12$3DOLmptNUulIYVMN7F50Ju5hQGEDuqy0mKXNhHLC3Pp5ED0kk0SEG',
    1
);

INSERT INTO assets (name, type, status, location)
VALUES
    (
        'Shivajinagar',
        'SENSOR',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.6000 12.9833)')
    ),
    (
        'Central Command',
        'C2_NODE',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.5946 12.9716)')
    ),
    (
        'Richmond Relay',
        'RELAY',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.6100 12.9570)')
    ),
    (
        'Palace Watch',
        'EO_SENSOR',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.5850 12.9980)')
    ),
    (
        'Southwest Outpost',
        'RADAR',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.5400 12.9200)')
    ),
    (
        'Vector Jammer Unit 1',
        'JAMMER',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.5680 12.9480)')
    ),
    (
        'DF North Node 1',
        'DIRECTION_FINDER',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.5720 12.9750)')
    );

INSERT INTO jammer_profiles (
    asset_id,
    manufacturer,
    model_number,
    variant_block,
    serial_number,
    asset_class,
    jammer_subtype,
    mission_domain,
    lifecycle_state,
    dimensions_l_m,
    dimensions_w_m,
    dimensions_h_m,
    weight_kg,
    environmental_rating,
    operating_temp_min_c,
    operating_temp_max_c,
    ingress_protection_rating,
    platform_type,
    mounting_configuration,
    antenna_configuration,
    vehicle_power_bus_type,
    cooling_integration_type,
    time_source_interface,
    ip_address,
    port,
    rf_coverage_min_mhz,
    rf_coverage_max_mhz,
    max_effective_radiated_power_dbm,
    simultaneous_channels_max,
    waveform_family_support,
    modulation_support,
    geolocation_method_support,
    preset_technique_library_id,
    input_voltage_min_v,
    input_voltage_max_v,
    nominal_power_draw_w,
    peak_power_draw_w,
    battery_backup_present,
    battery_backup_duration_min,
    mtbf_hours,
    built_in_test_level,
    secure_boot_supported,
    tamper_detection_supported,
    c2_interface_profiles,
    ip_stack_support,
    message_bus_protocols,
    api_spec_version,
    data_model_standard_refs,
    interoperability_cert_level,
    spectrum_authorization_profile,
    emissions_control_policy_id,
    rules_of_employment_profile_id,
    geofencing_policy_id,
    legal_jurisdiction_tags,
    doctrinal_role_tags,
    security_classification,
    crypto_module_type,
    authn_methods_supported,
    authz_role_profile_id,
    command_authorization_level,
    data_at_rest_encryption,
    data_in_transit_encryption,
    audit_policy_id,
    secure_logging_enabled,
    patch_baseline_version
)
SELECT
    a.id,
    'Example Defense Systems Ltd',
    'XJ-4000',
    'Block-II',
    'SN-XJ4-24-000198',
    'JAMMER',
    'COMMUNICATIONS_JAMMER',
    'LAND',
    'ACTIVE_SERVICE',
    1.2,
    0.8,
    0.65,
    285.5,
    'MIL-STD-810H',
    -32,
    55,
    'IP67',
    'GROUND_VEHICLE',
    'FIXED_RACK',
    'DUAL_WIDEBAND_OMNI',
    'MIL_28V_DC',
    'FORCED_AIR',
    'PTP_IEEE1588',
    '127.0.0.1',
    5001,
    20.0,
    6000.0,
    60.0,
    4,
    '["NOISE", "BARRAGE"]'::jsonb,
    '["AM", "FM", "PSK", "QAM"]'::jsonb,
    '["AOA", "TDOA"]'::jsonb,
    'LIB-EW-TCH-2026.1',
    22.0,
    30.0,
    1800.0,
    2600.0,
    true,
    20,
    3200.0,
    'COMPREHENSIVE',
    true,
    true,
    '["C2-EW-IP-PROF-01"]'::jsonb,
    '["IPv4", "IPv6"]'::jsonb,
    '["DDS", "AMQP"]'::jsonb,
    'EW-JAMMER-API-v2.3',
    '["NATO_ADatP-3_Profile_A"]'::jsonb,
    'NATO_PROFILE_TESTED',
    'SPEC-AUTH-LAND-REGION-4',
    'EMCON-POL-ALPHA',
    'ROE-EW-PROFILE-B',
    'GEOFENCE-SECTOR-NORTH',
    '["NAT-A", "NATO", "HOST-NATION-B"]'::jsonb,
    '["COMMS_DENIAL_SUPPORT", "FORCE_PROTECTION"]'::jsonb,
    'SECRET',
    'FIPS140-3_LEVEL3_HSM',
    '["PKI_MTLS", "CAC_SMARTCARD"]'::jsonb,
    'RBAC-EW-OPS-V4',
    'DUAL_CONTROL_REQUIRED',
    'AES256_XTS',
    'TLS1_3_SUITE_B',
    'AUDIT-POL-C2-STRICT',
    true,
    'SECBASE-2026-Q1'
FROM assets a
WHERE a.name = 'Vector Jammer Unit 1';

INSERT INTO direction_finder_profiles (
    asset_id,
    manufacturer,
    model_number,
    variant_block,
    serial_number,
    platform_class,
    mobility_class,
    mission_domain,
    lifecycle_state,
    antenna_array_type,
    antenna_element_count,
    antenna_polarization_support,
    receiver_channel_count,
    sample_rate_max_sps,
    frequency_reference_type,
    frequency_reference_accuracy_ppb,
    timing_holdover_seconds,
    rf_min_mhz,
    rf_max_mhz,
    instantaneous_bandwidth_hz,
    df_methods_supported,
    bearing_accuracy_deg_rms,
    bearing_output_reference,
    sensitivity_dbm,
    dynamic_range_db,
    calibration_profile_id,
    deployment_mode,
    site_id,
    mount_height_agl_m,
    sensor_boresight_offset_deg,
    heading_alignment_offset_deg,
    lever_arm_offset_m,
    geodetic_datum,
    altitude_reference,
    survey_position_accuracy_m,
    network_node_id,
    primary_ipv4,
    transport_protocols,
    message_protocols,
    data_format_profiles,
    time_sync_protocol,
    ptp_profile,
    api_version,
    interoperability_profile,
    security_classification,
    releasability_marking,
    authz_policy_id,
    data_in_transit_encryption,
    secure_boot_enabled,
    audit_policy_id,
    firmware_version,
    software_stack_version,
    configuration_baseline_id,
    calibration_due_date,
    mtbf_hours,
    maintenance_echelon
)
SELECT
    a.id,
    'Acme Defense Systems',
    'ADF-9000',
    'Block-III',
    'ADF9K-2026-1182',
    'FIXED_SITE',
    'FIXED',
    'LAND',
    'ACTIVE_SERVICE',
    'CIRCULAR_ARRAY',
    8,
    '["VERTICAL", "HORIZONTAL"]'::jsonb,
    4,
    122880000.0,
    'OCXO_GPS_DISCIPLINED',
    5.0,
    1800,
    20.0,
    6000.0,
    40000000.0,
    '["PHASE_INTERFEROMETRY", "TDOA_ASSIST"]'::jsonb,
    1.8,
    'TRUE_NORTH_CLOCKWISE',
    -112.0,
    85.0,
    'CAL-ADF9000-B3-2026Q1',
    'STATIC_MAST',
    'SITE-ALPHA-12',
    18.5,
    0.7,
    -1.2,
    '{"x": 1.2, "y": -0.4, "z": 2.1}'::jsonb,
    'WGS84',
    'MSL',
    0.15,
    'DFNODE-NORTH-01',
    '10.42.8.21',
    '["TCP", "UDP"]'::jsonb,
    '["MQTT", "REST"]'::jsonb,
    '["C2-DF-BEARING-V2"]'::jsonb,
    'PTP_IEEE1588',
    'TELECOM_G8275_1',
    'v2.3',
    'NATO-EW-INT-PROFILE-4',
    'SECRET',
    'REL TO NATO',
    'RBAC-DF-OPS-V5',
    'TLS1_3_SUITE_B',
    true,
    'AUDIT-STRICT-DF',
    'FW-3.4.7',
    'SW-DF-2.9.1',
    'CFG-DF-BASE-2026Q1',
    '2026-09-30',
    4200.0,
    'O_I_LEVEL'
FROM assets a
WHERE a.name = 'DF North Node 1';

INSERT INTO geospatial_ingestion_sources (
        id,
        source_name,
        source_type,
        transport,
        classification,
        is_active,
        metadata
)
VALUES
        (
                'a1f6f4b8-f8a0-4f5b-9ef2-42d58a54aa01'::uuid,
                'UAV-Imagery-Alpha',
                'UAV_IMAGERY',
                'API',
                'SECRET',
                TRUE,
                '{
                    "fileIdentifier": "geo-src-uav-imagery-alpha-2026-03",
                    "language": "eng",
                    "dateStamp": "2026-03-22",
                    "identificationInfo": {
                        "title": "UAV Imagery Alpha Feed",
                        "abstract": "Near-real-time UAV EO/IR imagery stream for sector alpha surveillance."
                    }
                }'::jsonb
        ),
        (
                'a1f6f4b8-f8a0-4f5b-9ef2-42d58a54aa02'::uuid,
                'AIS-Coastal-Track-West',
                'AIS',
                'TCP',
                'UNCLASSIFIED',
                TRUE,
                '{
                    "fileIdentifier": "geo-src-ais-coastal-track-west-2026-03",
                    "language": "eng",
                    "dateStamp": "2026-03-22",
                    "identificationInfo": {
                        "title": "AIS Coastal Track West",
                        "abstract": "Marine vessel positional feed covering western coastal approaches."
                    }
                }'::jsonb
        ),
        (
                'a1f6f4b8-f8a0-4f5b-9ef2-42d58a54aa03'::uuid,
                'SAR-Archive-Bravo',
                'SAR',
                'S3',
                'CONFIDENTIAL',
                FALSE,
                '{
                    "fileIdentifier": "geo-src-sar-archive-bravo-2026-03",
                    "language": "eng",
                    "dateStamp": "2026-03-22",
                    "identificationInfo": {
                        "title": "SAR Archive Bravo",
                        "abstract": "Batch synthetic aperture radar archive for retrospective analysis and change detection."
                    }
                }'::jsonb
        );

INSERT INTO rf_signals (frequency, power_level, modulation, bandwidth_hz, confidence, doa_deg, location, detected_at)
VALUES
    (
        88000000.0,
        -53.18,
        'FM',
        200000.0,
        0.82,
        35.0,
        ST_GeogFromText('SRID=4326;POINT(77.5946 12.9716)'),
        '2026-01-15T10:00:00Z'
    ),
    (
        88000000.0,
        -50.10,
        'FM',
        200000.0,
        0.90,
        245.0,
        ST_GeogFromText('SRID=4326;POINT(77.6100 12.9850)'),
        '2026-01-15T10:00:05Z'
    ),
    (
        88000000.0,
        -57.20,
        'FM',
        200000.0,
        0.73,
        310.0,
        ST_GeogFromText('SRID=4326;POINT(77.6200 12.9600)'),
        '2026-01-15T10:00:10Z'
    );

INSERT INTO sms_node_health (source_node, last_heartbeat, online, metrics)
VALUES
    (
        'SMS_01',
        '2026-02-27T10:05:12Z',
        TRUE,
        '{"cpu": 34.8, "temperature_c": 51.9, "heartbeat_seq": 1042}'::jsonb
    );

INSERT INTO sms_detections (
    source_node,
    timestamp_utc,
    frequency_hz,
    bandwidth_hz,
    power_dbm,
    snr_db,
    modulation,
    confidence,
    latitude,
    longitude,
    altitude_m,
    doa_azimuth_deg,
    doa_elevation_deg,
    doa_rmse_deg,
    raw_payload
)
VALUES
    (
        'SMS_01',
        '2026-02-27T10:05:10Z',
        2450000000,
        2000000,
        -52.3,
        18.5,
        'unknown',
        0.82,
        28.5670,
        77.3210,
        210.0,
        145.0,
        0.0,
        10.0,
        '{"timestamp": "2026-02-27T10:05:10Z", "frequency": 2450000000, "bandwidth": 2000000, "power": -52.3, "snr": 18.5, "modulation": "unknown", "confidence": 0.82, "lat": 28.567, "lon": 77.321, "alt": 210, "doa": 145, "rmse_deg": 10}'::jsonb
    ),
    (
        'SMS_01',
        '2026-02-27T10:05:11Z',
        433920000,
        125000,
        -61.7,
        13.2,
        'DATA',
        0.74,
        28.5665,
        77.3221,
        208.0,
        132.0,
        0.0,
        12.0,
        '{"ts": 1772186711, "freq_hz": 433920000, "bw_hz": 125000, "power_dbm": -61.7, "snr": 13.2, "mode": "DATA", "score": 0.74, "latitude": 28.5665, "longitude": 77.3221, "altitude": 208, "doa_deg": 132, "rmse_deg": 12}'::jsonb
    ),
    (
        'SMS_01',
        '2026-02-27T10:05:12Z',
        2462000000,
        1000000,
        -57.9,
        15.1,
        'FH',
        0.79,
        28.5678,
        77.3203,
        209.0,
        149.0,
        0.0,
        9.0,
        '{"timestamp_utc": "2026-02-27T10:05:12Z", "frequency_hz": 2462000000, "bandwidth_hz": 1000000, "power_dbm": -57.9, "snr_db": 15.1, "modulation": "FH", "confidence": 0.79, "latitude": 28.5678, "longitude": 77.3203, "altitude_m": 209, "doa_azimuth_deg": 149, "doa_elevation_deg": 0, "doa_rmse_deg": 9}'::jsonb
    );

INSERT INTO sms_tracks (
    id,
    track_code,
    first_seen,
    last_seen,
    frequency_min_hz,
    frequency_max_hz,
    avg_power_dbm,
    mobility,
    classification,
    threat_level,
    centroid_latitude,
    centroid_longitude,
    metadata
)
VALUES
    (
        '11111111-2222-3333-4444-555555555555'::uuid,
        'TRK-98433',
        '2026-02-27T10:05:10Z',
        '2026-02-27T10:05:12Z',
        2449000000,
        2463000000,
        -56.0,
        'STATIC',
        'Unknown RF Emitter',
        2,
        28.5671,
        77.3211,
        '{"source_node": "SMS_01", "associated_detection_count": 3}'::jsonb
    );

INSERT INTO sms_threats (
    id,
    track_id,
    threat_type,
    risk_score,
    priority,
    recommended_action,
    status,
    details
)
VALUES
    (
        '66666666-7777-8888-9999-aaaaaaaaaaaa'::uuid,
        '11111111-2222-3333-4444-555555555555'::uuid,
        'Suspected UAV Control Link',
        0.78,
        'HIGH',
        'Deploy Jammer Sector 2',
        'OPEN',
        '{"rule": "Rule-UAV-CTRL", "source_node": "SMS_01"}'::jsonb
    );