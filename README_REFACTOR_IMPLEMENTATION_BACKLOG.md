# C2 Platform Refactor Implementation Backlog

## Goal
Translate the architecture audit into executable work that improves maintainability, scalability, performance, and production reliability across frontend, backend, database, and deployment.

## Planning Model
- Sprint length: 2 weeks
- Team lanes: Frontend, Backend, Database, DevOps, QA/SRE
- Estimation scale: S (1-2 days), M (3-5 days), L (6-10 days), XL (10+ days)
- Priority: P0 critical, P1 high, P2 medium

## Epic A: Architecture Baseline and Guardrails

### A1. Architecture Decision Records and standards baseline
- Priority: P0
- Owner: Software Architect
- Estimate: M
- Dependencies: None
- Scope:
  - Add ADRs for modular monolith direction, layering rules, and boundaries
  - Define folder and naming conventions for backend domains and frontend features
  - Define API error envelope and schema ownership rules
- Acceptance criteria:
  - ADR documents merged and approved
  - Contribution guide updated with enforceable standards
  - New PR template includes architecture checklist

### A2. Static quality gates enablement
- Priority: P0
- Owner: DevOps + Backend Lead + Frontend Lead
- Estimate: M
- Dependencies: A1
- Scope:
  - Add backend lint and type checks in CI
  - Ensure frontend strict typecheck is a blocking gate
  - Add migration validation check in CI
- Acceptance criteria:
  - CI fails on lint/type/migration violations
  - Main branch remains green for 5 consecutive merges

## Epic B: Backend Layering and Domain Refactor

### B1. Extract inline router schemas for CDR domain
- Priority: P0
- Owner: Backend Engineer
- Estimate: L
- Dependencies: A1
- Scope:
  - Move all inline models from cdr router to domain schema module
  - Keep API contract unchanged
  - Add unit tests for schema serialization and validation
- Acceptance criteria:
  - No inline Pydantic schemas remain in CDR router
  - Endpoint payloads remain backward compatible
  - Tests pass

### B2. Extract inline router schemas for Signal domain
- Priority: P0
- Owner: Backend Engineer
- Estimate: M
- Dependencies: A1
- Scope:
  - Move SignalLogRead, InterceptRequest, SignalIngestRequest into domain schemas
  - Introduce import consistency with other routers
- Acceptance criteria:
  - Signal router has no inline schema classes
  - Existing tests and smoke scripts pass

### B3. Router-to-service contract standardization
- Priority: P1
- Owner: Backend Lead
- Estimate: L
- Dependencies: B1, B2
- Scope:
  - Define service return strategy: domain DTOs, not mixed ORM dict hybrids
  - Add mapper layer for ORM to DTO conversion
  - Apply to alerts, RF, and telecom services first
- Acceptance criteria:
  - Selected services return consistent DTOs
  - Router handlers reduced to orchestration logic

### B4. Remove dead commented code in runtime-critical files
- Priority: P1
- Owner: Backend Engineer
- Estimate: S
- Dependencies: A1
- Scope:
  - Clean large commented legacy blocks in database and TCP server files
  - Preserve history through git, not source comments
- Acceptance criteria:
  - Commented legacy implementations removed
  - No behavior change in regression tests

### B5. Permission evaluation caching
- Priority: P1
- Owner: Backend Engineer + SRE
- Estimate: L
- Dependencies: B3
- Scope:
  - Introduce Redis-backed effective-permission cache
  - Add invalidation hooks on role and permission mutations
  - Add metrics for permission cache hit rate
- Acceptance criteria:
  - Measurable reduction in per-request RBAC DB lookups
  - Cache invalidation tested for role changes

## Epic C: Database Correctness and Performance

### C1. Resolve ORM-DDL drift for alerts
- Priority: P0
- Owner: Database Engineer + Backend Engineer
- Estimate: M
- Dependencies: A1
- Scope:
  - Align alerts table and ORM model field set
  - Add migration script and rollback plan
  - Add contract test to prevent future drift
- Acceptance criteria:
  - Model and DDL fields match
  - Migration tested in local and CI
  - CRUD flows validated by regression tests

### C2. Query plan baseline and index tuning pack
- Priority: P1
- Owner: Database Engineer
- Estimate: L
- Dependencies: C1
- Scope:
  - Capture top slow queries from telecom, alerts, and auth flows
  - Add or adjust indexes based on explain analyze results
  - Validate write overhead impact
- Acceptance criteria:
  - Documented before and after latency improvements
  - No significant regression in write-heavy paths

### C3. JSONB normalization candidates analysis
- Priority: P2
- Owner: Database Architect
- Estimate: M
- Dependencies: C2
- Scope:
  - Identify highest-value JSONB fields to normalize first
  - Propose phased migration for jammer and direction finder profile details
- Acceptance criteria:
  - Approved normalization design
  - Migration roadmap created with compatibility approach

## Epic D: Frontend Consolidation and Reuse

### D1. Unified realtime client module
- Priority: P0
- Owner: Frontend Engineer
- Estimate: M
- Dependencies: A1
- Scope:
  - Replace repeated websocket URL and connection boilerplate with shared client utility
  - Add reconnect policy and typed event contracts
- Acceptance criteria:
  - Realtime panels use shared client
  - Duplicate websocket literal usage removed from targeted modules

### D2. Charting stack consolidation
- Priority: P1
- Owner: Frontend Lead
- Estimate: L
- Dependencies: D1
- Scope:
  - Select primary charting library and deprecate redundant libraries
  - Migrate selected operator and telecom visualizations
  - Reduce bundle size and dependency footprint
- Acceptance criteria:
  - At least two charting libraries removed from dependencies
  - Build artifact size reduction recorded

### D3. API client normalization layer
- Priority: P1
- Owner: Frontend Engineer
- Estimate: M
- Dependencies: A1
- Scope:
  - Standardize error mapping and retry policy in API layer
  - Add typed domain adapters for key payloads
- Acceptance criteria:
  - Unified error handling behavior across API modules
  - Reduced duplicate response parsing in pages

## Epic E: DevOps Hardening and Production Readiness

### E1. CI workflow simplification and policy enforcement
- Priority: P0
- Owner: DevOps Engineer
- Estimate: S
- Dependencies: A2
- Scope:
  - Remove non-blocking typecheck stage once strict gate is enforced
  - Keep explicit build and smoke test stages
- Acceptance criteria:
  - CI definitions are non-redundant and policy aligned
  - Pipeline remains green across 3 consecutive PRs

### E2. Observability baseline
- Priority: P1
- Owner: SRE
- Estimate: L
- Dependencies: E1
- Scope:
  - Add structured logs with correlation IDs
  - Add metrics and dashboards for API latency, error rates, websocket health
  - Define alert thresholds and on-call runbook
- Acceptance criteria:
  - Dashboards available and used in incident triage
  - Alerts fire for synthetic failure scenarios

### E3. Environment and secrets hardening
- Priority: P1
- Owner: DevOps Engineer + Security Engineer
- Estimate: M
- Dependencies: E1
- Scope:
  - Remove plaintext bootstrap credentials from committed runtime defaults
  - Move secrets to secure runtime mechanism
  - Add rotation procedure documentation
- Acceptance criteria:
  - No plaintext production secrets in repo
  - Secret rotation tested and documented

## Epic F: Validation, Risk Controls, and Rollout

### F1. Contract test suite for critical APIs
- Priority: P0
- Owner: QA Engineer + Backend Engineer
- Estimate: M
- Dependencies: B1, B2, C1
- Scope:
  - Add API contract tests for auth, telecom, signal, SMS, and alerts
  - Pin response schemas and status code behavior
- Acceptance criteria:
  - Contract tests run in CI
  - Breaking API changes detected automatically

### F2. Performance regression gate
- Priority: P1
- Owner: QA Performance Engineer
- Estimate: M
- Dependencies: C2, E2
- Scope:
  - Add benchmark script for high-volume endpoints and websocket throughput
  - Define fail thresholds in CI or pre-release gate
- Acceptance criteria:
  - Baseline and threshold documented
  - Gate blocks regressions above threshold

### F3. Progressive rollout checklist
- Priority: P1
- Owner: Release Manager + SRE
- Estimate: S
- Dependencies: E2, F1
- Scope:
  - Define staged rollout with canary criteria
  - Add rollback runbook and decision triggers
- Acceptance criteria:
  - Dry run completed in staging
  - Rollback path validated end-to-end

## Sprint Sequence Recommendation

### Sprint 1
- A1, A2, C1, B1 (start), D1 (start), E1

### Sprint 2
- B1 complete, B2, B4, D1 complete, F1 (start)

### Sprint 3
- B3, C2 (start), D3, E2 (start), F1 complete

### Sprint 4
- C2 complete, D2 (start), E2 complete, E3, F2

### Sprint 5+
- D2 complete, C3, B5, F3

## KPI Targets
- Reduce backend P95 latency on top 5 endpoints by 25 percent
- Reduce frontend production bundle size by at least 15 percent
- Cut RBAC-related DB lookups per request by at least 60 percent
- Keep CI median duration under 20 minutes while increasing checks
- Zero schema drift incidents after contract and migration checks

## Immediate Next Actions
- Assign owners and dates for all P0 items
- Open implementation tickets from this backlog
- Schedule architecture review checkpoint at end of Sprint 1
