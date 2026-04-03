# C2 Platform Refactor Tickets (GitHub Issues Style)

Use one section per GitHub issue.
Suggested labels format: `area:*`, `priority:*`, `size:*`, `type:*`.

---

## Issue 1: Architecture standards baseline with ADRs
- Title: Establish architecture standards and ADR baseline
- Labels: area:architecture, priority:P0, size:M, type:governance

### Description
Create enforceable architecture standards and ADRs for the modular monolith direction.

### Scope
- Add ADR for target architecture and boundaries
- Define backend layering and schema ownership conventions
- Define frontend feature/module conventions
- Update contribution and PR checklist docs

### Dependencies
- None

### Acceptance Criteria
- ADRs approved and merged
- Contribution guide updated
- PR template includes architecture checklist

---

## Issue 2: Enable backend lint/type and migration gates in CI
- Title: Add backend static checks and migration validation in CI
- Labels: area:devops, area:backend, priority:P0, size:M, type:ci

### Description
Expand CI quality gates to include backend static analysis and DB migration validation.

### Scope
- Add backend lint checks
- Add backend type checks
- Add migration verification step in CI
- Keep pipeline duration within target budget

### Dependencies
- Issue 1

### Acceptance Criteria
- CI fails on lint/type/migration errors
- Main branch remains green for 5 consecutive merges

---

## Issue 3: Extract inline CDR schemas from router
- Title: Refactor CDR router schemas into dedicated schema modules
- Labels: area:backend, priority:P0, size:L, type:refactor

### Description
Move inline CDR Pydantic models from router to domain schema modules while preserving contracts.

### Scope
- Extract all inline schema classes from `backend/app/routers/cdr_router.py`
- Update imports/usages
- Add schema serialization/validation tests

### Dependencies
- Issue 1

### Acceptance Criteria
- No inline schema classes remain in CDR router
- API contract unchanged
- Tests pass

---

## Issue 4: Extract inline Signal schemas from router
- Title: Refactor Signal router schemas into dedicated schema modules
- Labels: area:backend, priority:P0, size:M, type:refactor

### Description
Move inline Signal Pydantic models from router to domain schemas.

### Scope
- Extract classes from `backend/app/routers/signal_router.py`
- Update imports/usages
- Add tests for request/response validation

### Dependencies
- Issue 1

### Acceptance Criteria
- No inline schema classes in Signal router
- API behavior unchanged
- Tests pass

---

## Issue 5: Resolve Alerts ORM-DDL schema drift
- Title: Align alerts ORM model with SQL schema via migration
- Labels: area:database, area:backend, priority:P0, size:M, type:migration

### Description
Fix schema drift between `backend/app/models.py` and `database/init.sql` for alerts.

### Scope
- Reconcile columns and constraints
- Add migration and rollback strategy
- Add contract test to detect future drift

### Dependencies
- Issue 1

### Acceptance Criteria
- ORM and DB schema aligned
- Migration tested locally and in CI
- Alerts CRUD regression passes

---

## Issue 6: Standardize router-service DTO contracts
- Title: Introduce consistent service DTO contract pattern
- Labels: area:backend, priority:P1, size:L, type:refactor

### Description
Eliminate mixed service return styles (ORM objects vs dict) using DTO and mapper layers.

### Scope
- Define service DTO contract policy
- Add mappers for selected domains
- Apply to alerts, RF, telecom services first

### Dependencies
- Issue 3
- Issue 4

### Acceptance Criteria
- Selected services return consistent DTOs
- Routers are orchestration-only

---

## Issue 7: Remove dead commented backend legacy code
- Title: Clean legacy commented code from runtime-critical backend files
- Labels: area:backend, priority:P1, size:S, type:cleanup

### Description
Remove large commented legacy implementations from key files.

### Scope
- Clean `backend/app/database.py`
- Clean `backend/app/services/tcp_server.py`

### Dependencies
- Issue 1

### Acceptance Criteria
- Legacy commented blocks removed
- No behavior regressions in smoke tests

---

## Issue 8: Add RBAC permission caching with invalidation
- Title: Implement Redis-backed effective permission caching
- Labels: area:backend, area:security, priority:P1, size:L, type:performance

### Description
Reduce DB load from per-request permission evaluation by introducing cache + invalidation hooks.

### Scope
- Cache effective permissions per role/user
- Invalidate on role/permission changes
- Add hit/miss metrics

### Dependencies
- Issue 6

### Acceptance Criteria
- Significant reduction in RBAC DB lookups
- Permission changes propagate correctly

---

## Issue 9: Build DB query plan baseline and index tuning pack
- Title: Profile top queries and optimize indexes using explain analyze
- Labels: area:database, priority:P1, size:L, type:performance

### Description
Use measured query plans to optimize high-load paths.

### Scope
- Capture top slow queries in telecom/alerts/auth
- Propose and apply index changes
- Validate read improvements and write overhead

### Dependencies
- Issue 5

### Acceptance Criteria
- Before/after performance report
- No significant write regression

---

## Issue 10: Analyze JSONB normalization candidates
- Title: Design normalization plan for high-value JSONB fields
- Labels: area:database, priority:P2, size:M, type:design

### Description
Identify JSONB fields suitable for relational normalization.

### Scope
- Assess jammer and DF profile JSONB fields
- Propose phased migration model with compatibility strategy

### Dependencies
- Issue 9

### Acceptance Criteria
- Approved normalization design
- Roadmap documented

---

## Issue 11: Create unified frontend realtime client
- Title: Consolidate websocket connection logic into shared realtime client
- Labels: area:frontend, priority:P0, size:M, type:refactor

### Description
Replace repeated websocket endpoint and reconnect logic across UI modules.

### Scope
- Create shared realtime client utility
- Migrate operator/telemetry consumers to shared client
- Define typed event contracts

### Dependencies
- Issue 1

### Acceptance Criteria
- Shared client adopted in target modules
- Duplicate websocket literals removed

---

## Issue 12: Consolidate charting stack and reduce bundle footprint
- Title: Standardize on primary charting stack and remove redundant libraries
- Labels: area:frontend, priority:P1, size:L, type:performance

### Description
Reduce dependency sprawl and bundle size from multiple charting frameworks.

### Scope
- Choose primary charting library
- Migrate selected visualizations
- Remove redundant chart deps

### Dependencies
- Issue 11

### Acceptance Criteria
- At least two charting libs removed
- Bundle size reduction documented

---

## Issue 13: Normalize frontend API error and retry behavior
- Title: Implement unified API error mapping and retry policy
- Labels: area:frontend, priority:P1, size:M, type:refactor

### Description
Standardize API client behavior for errors and retries.

### Scope
- Add centralized error normalization
- Add retry policy for safe/idempotent calls
- Add typed adapters for key payloads

### Dependencies
- Issue 1

### Acceptance Criteria
- Consistent API error behavior across modules
- Reduced duplicate parsing logic in pages

---

## Issue 14: Simplify CI frontend gate semantics
- Title: Remove non-blocking typecheck stage after strict gate enforcement
- Labels: area:devops, priority:P0, size:S, type:ci

### Description
Make CI intent explicit and non-redundant for frontend validation.

### Scope
- Remove transitional non-blocking typecheck step
- Keep strict typecheck+build gate path

### Dependencies
- Issue 2

### Acceptance Criteria
- CI workflow simplified
- Pipeline policy and behavior aligned

---

## Issue 15: Add observability baseline and SLO alerting
- Title: Introduce logs, metrics, dashboards, and alert thresholds
- Labels: area:devops, area:sre, priority:P1, size:L, type:observability

### Description
Establish production-grade visibility for API and realtime paths.

### Scope
- Structured logs with correlation IDs
- API and websocket metrics
- Dashboards and alert thresholds
- Incident runbook

### Dependencies
- Issue 14

### Acceptance Criteria
- Dashboards available for on-call
- Alerts validated via synthetic failure test

---

## Issue 16: Harden environment and secret management
- Title: Remove plaintext runtime secrets and implement secure secret handling
- Labels: area:devops, area:security, priority:P1, size:M, type:hardening

### Description
Move sensitive configuration to secure secret workflows and document rotation.

### Scope
- Remove plaintext bootstrap secrets from committed runtime defaults
- Integrate secure secret source for deployment
- Document and test rotation

### Dependencies
- Issue 14

### Acceptance Criteria
- No plaintext production secrets in repo
- Rotation procedure tested and documented

---

## Issue 17: Add API contract test suite
- Title: Build contract tests for critical API domains
- Labels: area:qa, area:backend, priority:P0, size:M, type:testing

### Description
Pin API behavior for critical domains to prevent accidental breakage.

### Scope
- Add contract tests for auth, telecom, signal, SMS, alerts
- Assert schema and status-code compatibility

### Dependencies
- Issue 3
- Issue 4
- Issue 5

### Acceptance Criteria
- Contract tests run in CI
- Breaking API changes fail CI

---

## Issue 18: Add performance regression gate
- Title: Add perf benchmark suite and regression thresholds
- Labels: area:qa, area:performance, priority:P1, size:M, type:testing

### Description
Guard key endpoint and websocket throughput performance with measurable thresholds.

### Scope
- Implement benchmark scripts for key paths
- Define pass/fail thresholds
- Integrate into pre-release gate

### Dependencies
- Issue 9
- Issue 15

### Acceptance Criteria
- Baseline and thresholds documented
- Regressions above threshold are blocked

---

## Issue 19: Implement progressive rollout and rollback checklist
- Title: Define canary rollout and validated rollback runbook
- Labels: area:release, area:sre, priority:P1, size:S, type:operations

### Description
Standardize safe production rollout and rollback process.

### Scope
- Define staged rollout criteria
- Define rollback triggers and steps
- Run staging dry-run

### Dependencies
- Issue 15
- Issue 17

### Acceptance Criteria
- Staging dry-run completed
- Rollback path validated end-to-end

---

## Milestone Grouping Suggestion
- Milestone 1: Foundation and correctness
  - Issues: 1, 2, 3, 4, 5, 11, 14, 17
- Milestone 2: Performance and consistency
  - Issues: 6, 8, 9, 12, 13, 18
- Milestone 3: Hardening and operations
  - Issues: 7, 10, 15, 16, 19
