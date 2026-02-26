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