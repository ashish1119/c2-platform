INSERT INTO roles (name) VALUES
('ADMIN'),
('OPERATOR');

INSERT INTO users (username, email, hashed_password, role_id)
VALUES (
    'admin',
    'admin@c2.local',
    '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7nZ9YjRzCQXDpUe1koRaSPo6e7iT730', -- password: password
    1
);

INSERT INTO assets (name, type, status, location)
VALUES
    (
        'Asset Shivajinagar',
        'SENSOR',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.6000 12.9833)')
    ),
    (
        'Asset Central Command',
        'C2_NODE',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.5946 12.9716)')
    ),
    (
        'Asset Richmond Relay',
        'RELAY',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.6100 12.9570)')
    ),
    (
        'Asset Palace Watch',
        'EO_SENSOR',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.5850 12.9980)')
    ),
    (
        'Asset Southwest Outpost',
        'RADAR',
        'ACTIVE',
        ST_GeogFromText('SRID=4326;POINT(77.5400 12.9200)')
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