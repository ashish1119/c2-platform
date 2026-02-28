# SMS → C2 Integration Plan (Production Blueprint, Project-Aligned)

This plan maps the provided SMS integration blueprint to the existing `c2-platform` stack:

- Backend: FastAPI + async SQLAlchemy + PostgreSQL/PostGIS
- Frontend: React + TypeScript + Vite
- Existing patterns: integration modules (`backend/app/integrations/*`), service + router layers, role-based permissions, map-driven operator views

---

## 1) Target Architecture for This Repo

```text
SMS Node(s) (ZeroMQ/WebSocket publisher)
        │
        ▼
SMS Adapter Service (new backend integration module)
        │
        ├─ Persist raw detections/targets (normalized)
        ├─ Publish internal events (WebSocket now, Kafka/NATS optional)
        ▼
Fusion + Threat services (new backend services)
        │
        ▼
Operational DB (PostgreSQL/PostGIS)
        │
        ▼
Frontend (map + EW + spectrum panels)
```

### Recommended incremental rollout

1. **Phase A (Immediate)**: Adapter + normalized detection ingest + health + map overlays
2. **Phase B**: Track fusion + threat scoring + operator alerting
3. **Phase C**: Event bus (Kafka/NATS), time-series storage, replay/forensics

---

## 2) New Backend Modules (Proposed)

- `backend/app/integrations/sms/`
  - `codec.py` (ZeroMQ/WebSocket payload parsing)
  - `models.py` (typed adapter-side payload models)
  - `service.py` (connect/consume/normalize pipeline)
  - `state_cache.py` (node heartbeat and latest telemetry)
  - `transport.py` (ZeroMQ socket/websocket client wrappers)

- `backend/app/services/`
  - `sms_detection_service.py` (CRUD/list/query normalized detections)
  - `sms_fusion_service.py` (frequency/time/spatial association)
  - `sms_threat_service.py` (rule engine + risk score)

- `backend/app/routers/`
  - `sms_router.py` (control/status + detection/track/threat read APIs)

---

## 3) Normalized C2 Schema (Project Entities)

### 3.1 `sms_detections` (raw normalized)

Core fields:
- `id` (UUID PK)
- `source_node` (text, indexed)
- `timestamp_utc` (timestamptz, indexed)
- `frequency_hz` (bigint, indexed)
- `bandwidth_hz` (integer)
- `power_dbm` (numeric)
- `snr_db` (numeric)
- `modulation` (text)
- `confidence` (numeric)
- `lat/lon/alt` (+ `location geography(Point,4326)`)
- `doa_azimuth_deg`, `doa_elevation_deg`, `doa_rmse_deg`
- `raw_payload` (jsonb)

### 3.2 `sms_tracks` (fused tracks)

- `id` (UUID PK)
- `track_code` (unique text, e.g., `TRK-...`)
- `first_seen`, `last_seen`
- `freq_min_hz`, `freq_max_hz`
- `avg_power_dbm`
- `classification`
- `threat_level` (int 0-5)
- `mobility`
- `centroid location`
- `metadata` (jsonb)

### 3.3 `sms_threats`

- `id` (UUID PK)
- `track_id` (FK -> `sms_tracks.id`)
- `threat_type`
- `risk_score` (0..1)
- `priority` (`LOW|MEDIUM|HIGH|CRITICAL`)
- `recommended_action`
- `status` (`OPEN|ACK|MITIGATED|CLOSED`)
- `created_at`, `updated_at`

### 3.4 `sms_node_health`

- `id` (UUID PK)
- `source_node` (unique)
- `last_heartbeat`
- `online` (bool)
- `metrics` (jsonb)

---

## 4) API Contract (FastAPI)

### Adapter/admin
- `POST /sms/nodes/{node_id}/connect`
- `POST /sms/nodes/{node_id}/disconnect`
- `GET /sms/nodes`
- `GET /sms/nodes/{node_id}/health`

### Data read APIs
- `GET /sms/detections?from=&to=&freq_min=&freq_max=&bbox=`
- `GET /sms/tracks?active_only=true`
- `GET /sms/threats?priority=HIGH&status=OPEN`
- `GET /sms/spectrum/occupancy?window=60s`

### Control/ops
- `POST /sms/threats/{id}/ack`
- `POST /sms/tracks/{id}/classify`

Permissions to seed:
- `sms:read`, `sms:write`, `sms:*`
- `sms_threat:read`, `sms_threat:write`

---

## 5) Fusion Logic (Implementable Baseline)

### Level 1: Frequency-time clustering
- Link detections where:
  - `abs(freq_i - freq_j) <= max(bandwidth_i, bandwidth_j)`
  - `abs(t_i - t_j) <= 2 sec`

### Level 2: Spatial/DOA association
- Single node: keep bearing fan + uncertainty
- Multi node: intersect bearing rays (weighted by RMSE)

### Level 3: Behavioral signature checks
- periodic burst detection
- hopping-rate estimate
- occupancy pattern profile

Output: update/create `sms_tracks` and emit threat candidates.

---

## 6) Threat Rules (Initial deterministic set)

- **Rule-UAV-CTRL**: 2.4 GHz narrowband + periodic burst + moderate/high confidence → `Suspected UAV Control Link`
- **Rule-JAMMER-WIDE**: wideband elevated noise floor + rapid occupancy expansion → `Potential Jammer`
- **Rule-HOPPING-COMMS**: high hop count and short dwell windows → `Possible Military/FH Link`

Risk score composition (baseline):
- confidence weight (0.35)
- persistence/recurrence (0.25)
- proximity to protected geo-fence (0.25)
- known signature similarity (0.15)

---

## 7) Frontend Integration (Current UI-aligned)

Add to operator/admin flows:

- **Map overlays**
  - SMS node markers
  - DOA bearings (fan/ray with uncertainty)
  - fused track markers
  - threat markers (priority-color coded)

- **EW panel widgets**
  - active threats by priority
  - top emitters (frequency + power)
  - occupancy chart (windowed)

- **Filters**
  - frequency range
  - confidence threshold
  - source node
  - threat status/priority

---

## 8) Security Hardening Requirements

- Do not keep wildcard bind (`tcp://*`) on exposed networks.
- Use one of:
  - ZeroMQ CURVE
  - TLS tunnel/proxy
  - site VPN
- Enforce RBAC on new SMS endpoints.
- Audit all threat state transitions (`ACK`, `MITIGATED`, `CLOSED`).

---

## 9) Storage Strategy

- **Operational store**: PostgreSQL/PostGIS (detections/tracks/threats/health)
- **Time-series** (optional next phase): Timescale/Influx for PSD-intensive streams
- **Cold store** (optional next phase): object storage for IQ/replay bundles

---

## 10) Immediate Sprint Backlog (Executable)

### Sprint-1 (must-have)
1. Add DB models + migration SQL for `sms_detections`, `sms_tracks`, `sms_threats`, `sms_node_health`
2. Implement `sms_router.py` with read + health endpoints
3. Implement adapter skeleton (`integrations/sms`) with payload normalization
4. Seed permissions and wire router in `main.py`
5. Add operator map overlay for detections + threats

### Sprint-2
1. Add fusion service (L1+L2 baseline)
2. Add threat rules and risk score pipeline
3. Add EW dashboard cards and filters

### Sprint-3
1. Add Kafka/NATS publisher and consumer split
2. Add time-series persistence and replay API
3. Add model-assisted classifier hooks

---

## 11) Operational SLO Baseline

- Detection ingest latency (P95): < 500 ms
- Threat generation delay (P95): < 2 s
- Node offline detection: 10 s (heartbeat interval 3 s)
- API read response (P95): < 300 ms for active tracks/threats

---

## 12) Acceptance Criteria

- SMS detections visible on map within 1 second of publish
- Threats auto-generated for baseline rules and visible in operator UI
- Node health transitions to offline in <= 10 seconds if heartbeat loss
- RBAC enforcement verified for all `/sms/*` endpoints
- OpenAPI includes complete SMS API surface and schema docs

---

## 13) Notes for Current Repo State

- Existing direction-finder and jammer modules already provide a reusable pattern for:
  - schema + service + router layering
  - permission seeding on startup
  - admin/operator UI segmentation
- Implement SMS using the same conventions to reduce integration risk and code drift.

---

## 14) Quick API Test (Adapter Ingest)

Use this endpoint to ingest raw SMS payloads through the normalizer:

- `POST /sms/adapter/ingest`

### Sample request body

```json
{
  "source_node": "SMS_01",
  "metrics": {
    "cpu": 37.2,
    "temperature_c": 52.1,
    "heartbeat_seq": 1042
  },
  "detections": [
    {
      "timestamp": "2026-02-27T10:05:10Z",
      "frequency": 2450000000,
      "bandwidth": 2000000,
      "power": -52.3,
      "snr": 18.5,
      "modulation": "unknown",
      "confidence": 0.82,
      "lat": 28.567,
      "lon": 77.321,
      "alt": 210,
      "doa": 145,
      "rmse_deg": 10
    },
    {
      "ts": 1772186712,
      "freq_hz": 433920000,
      "bw_hz": 125000,
      "power_dbm": -61.7,
      "mode": "DATA",
      "score": 0.74,
      "latitude": 28.5665,
      "longitude": 77.3221,
      "doa_deg": 132
    }
  ]
}
```

### PowerShell test command

```powershell
$body = @{
  source_node = "SMS_01"
  metrics = @{
    cpu = 37.2
    temperature_c = 52.1
    heartbeat_seq = 1042
  }
  detections = @(
    @{
      timestamp = "2026-02-27T10:05:10Z"
      frequency = 2450000000
      bandwidth = 2000000
      power = -52.3
      snr = 18.5
      modulation = "unknown"
      confidence = 0.82
      lat = 28.567
      lon = 77.321
      alt = 210
      doa = 145
      rmse_deg = 10
    },
    @{
      ts = 1772186712
      freq_hz = 433920000
      bw_hz = 125000
      power_dbm = -61.7
      mode = "DATA"
      score = 0.74
      latitude = 28.5665
      longitude = 77.3221
      doa_deg = 132
    }
  )
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Uri "http://localhost:8000/sms/adapter/ingest" -Method POST -Body $body -ContentType "application/json"
```

### Verify ingestion

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/sms/detections?limit=5" -Method GET
Invoke-RestMethod -Uri "http://localhost:8000/sms/nodes/SMS_01/health" -Method GET
```

---

## 15) SMS Seed Data Smoke Tests

Run these after DB init + seed and backend startup:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/sms/nodes" -Method GET
Invoke-RestMethod -Uri "http://localhost:8000/sms/detections?limit=10" -Method GET
Invoke-RestMethod -Uri "http://localhost:8000/sms/tracks?active_only=false&limit=10" -Method GET
Invoke-RestMethod -Uri "http://localhost:8000/sms/threats?limit=10" -Method GET
```

Optional endpoint presence check:

```powershell
$paths = (Invoke-RestMethod -Uri "http://localhost:8000/openapi.json" -Method GET).paths.PSObject.Properties.Name
[pscustomobject]@{
  '/sms/nodes' = ($paths -contains '/sms/nodes')
  '/sms/detections' = ($paths -contains '/sms/detections')
  '/sms/tracks' = ($paths -contains '/sms/tracks')
  '/sms/threats' = ($paths -contains '/sms/threats')
  '/sms/adapter/ingest' = ($paths -contains '/sms/adapter/ingest')
} | ConvertTo-Json
```
