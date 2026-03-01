# Military GIS Phase 1 Backlog (Sprint-Ready)

## Objective
Deliver a secure geospatial foundation for command-station operations by implementing:
- multi-source ingestion registry,
- military coordinate conversion services,
- metadata discipline,
- RBAC-controlled APIs.

## Scope (Phase 1)
1. Geospatial ingestion control plane
2. Coordinate interoperability services (WGS84/UTM/MGRS)
3. ISO 19115 metadata envelope support (initial profile)
4. Security baseline (RBAC + transport hardening hooks)

## Epics and User Stories

### Epic A: Multi-Source Ingestion Registry
- **A1** Register source feeds by type (`VECTOR`, `RASTER`, `LIDAR`, `SAR`, `BATHYMETRY`, `UAV_IMAGERY`, `AIS`, `ADS_B`, `SIGINT`).
- **A2** List registered feeds with classification and transport metadata.
- **A3** Expose geospatial capability discovery endpoint for clients.

**API delivered**
- `GET /geospatial/capabilities`
- `GET /geospatial/ingestion/sources`
- `POST /geospatial/ingestion/sources`

### Epic B: Military Coordinate Interoperability
- **B1** Convert `WGS84 -> UTM` for precision operations.
- **B2** Convert `UTM -> WGS84` for shared COP rendering.
- **B3** Convert `WGS84 <-> MGRS` for coalition targeting workflows.
- **B4** Convert `UTM <-> MGRS` via WGS84 normalization.

**API delivered**
- `POST /geospatial/coordinates/convert`

### Epic C: Security & Governance
- **C1** Add `geospatial:read` and `geospatial:write` permissions.
- **C2** Seed ADMIN role mappings at startup.
- **C3** Keep endpoints permission-gated with existing `require_permission` dependency.

## Data Contracts (Implemented)
- `GeospatialSourceRegisterRequest`
- `GeospatialSourceRead`
- `CoordinateConvertRequest`
- `CoordinateConvertResponse`

## Definition of Done (Phase 1)
- RBAC enforced on all geospatial endpoints.
- Conversion endpoint supports all pairwise transformations among `WGS84`, `UTM`, `MGRS`.
- Source registry validates supported source categories.
- Capability endpoint reports supported coordinate systems and MGRS availability.

## Sprint Breakdown (Suggested)

### Sprint 1 (Current)
- Implement API contracts and service logic.
- Wire router and permission seeds.
- Validate backend build and startup.

### Sprint 2
- Persist ingestion sources in PostGIS-backed table.
- Add ISO 19115 metadata profile validation.
- Add audit-log entries for register/update/deactivate actions.

### Sprint 3
- Add STANAG/OGC gateway adapters (`WMS`, `WFS`, `WMTS`) and secure connector configs.
- Add health telemetry for feed lag, stale-source alarms, and ingest throughput.

## Non-Goals (Current increment)
- Full raster/LiDAR tile processing pipeline.
- 3D/4D globe rendering.
- Satellite orthorectification chain.
- AI predictive threat engine.

## Risks / Notes
- `MGRS` conversion requires runtime `mgrs` package.
- High-throughput ingestion should move from in-memory registry to database-backed records in Sprint 2.
- Air-gapped deployment requirements should include internal package mirror strategy.
