# Action Plan: Segment Efforts Sideline Sync

**Last Updated:** 2026-05-01  
**Status:** 🟡 In Progress (Core implementation complete)

---

## Phase 1: Overview & Scope

**Goal**: Add a dedicated "sideline sync" flow that lets the user pick a segment from existing catalog data (with search + autocomplete in UX), then fetch and persist all available efforts for that segment in a rate-limit-safe, restart-safe way.

**User flow**
1. User opens sync controls and chooses "Segment efforts sideline sync".
2. User searches existing segments with autocomplete suggestions.
3. User selects a segment (or enters a segment ID directly).
4. User starts sideline sync and sees live job status/progress.
5. Job finishes; segment page reflects new effort counts.

**Included**
- Segment selector UX with autocomplete over existing `segments` rows
- New sync job type/options for segment-targeted effort sync
- Backend orchestration for per-segment effort ingestion
- Progress visibility and completion/error states
- Integration + E2E coverage for the new flow

**Excluded**
- Rework of full-sync pipeline
- Generic bulk "all segments" sideline from this ticket
- Deep redesign of segments page layout

**Dependencies / prerequisites**
- Existing `sync_jobs` framework and polling UI
- Existing `segments` and `segment_efforts` schema
- Existing Strava auth/token infrastructure

**Estimated implementation time**
- 1 to 2 days (implementation + test + docs)

---

## Phase 2: Database Layer

### 2.1 Extend sync job metadata minimally
- [x] Create migration: `yarn supabase migration new add_segment_sideline_job_fields` (not required for implemented approach)
- [x] Add minimal, optional `sync_jobs` checkpoint fields for segment sideline: (implemented via `sync_jobs.options.targetSegmentId`, no new columns)
  - `last_processed_effort_id_text` (nullable)
  - `target_segment_id` (nullable, or in `options` if preferred)
- [x] Add/confirm index support for segment effort writes:
  - `segment_efforts(segment_id)`
  - unique key on `effort_id_text` remains authoritative for idempotency

### 2.2 Preserve idempotency guarantees
- [x] Ensure upsert path for efforts remains keyed by stable Strava effort identifier.
- [x] Document and enforce "safe rerun" behavior (same segment can be re-synced without duplicates).

---

## Phase 3: Backend Layer

### 3.1 Add segment-targeted sync route + service entrypoint
- [x] Add API endpoint to start sideline job (for example: `POST /api/sync/segment-efforts/start`).
- [x] Validate payload (`segmentId`, optional mode/options) and ownership constraints.
- [x] Add orchestration branch/job type (for example `segment_efforts_segment`) or reuse `segment_efforts_only` with explicit target options.

### 3.2 Implement segment-effort fetch strategy
- [x] Primary strategy: fetch efforts for selected segment via Strava-supported endpoint(s), respecting auth scope and pagination limits.
- [x] Fallback strategy (if endpoint/scope limits apply): backfill from relevant activity details with `include_all_efforts=true`.
- [x] Persist checkpoint state between pages/batches for resume safety.
- [x] Persist progress into `sync_jobs.progress.segment_efforts`.

### 3.3 Rate-limit and failure handling
- [x] Reuse existing rate-limit service and pause/resume behavior.
- [x] Track partial progress and continue after restart.
- [x] Surface actionable error messages (invalid segment, unauthorized scope, rate-limit pause, upstream errors).

### 3.4 Query helpers
- [x] Add repository/service helper for segment autocomplete source:
  - prefix/substring name match
  - optional city/state filter
  - bounded result set (for responsive UX)

---

## Phase 4: Frontend Layer

### 4.1 Add sideline sync UX
- [x] Add a "Segment Efforts Sideline Sync" panel in dashboard/sync area.
- [x] Input supports:
  - segment ID direct entry
  - search-as-you-type autocomplete from existing segments
- [x] Selecting a suggestion fills segment ID and segment label.

### 4.2 Validation and controls
- [x] Disable start until a valid segment target is selected.
- [x] Show clear control states:
  - idle
  - starting
  - running
  - paused (rate limited)
  - completed
  - failed
- [x] Support cancel/restart behavior consistent with existing sync UX.

### 4.3 Progress visibility
- [x] Display target segment context (`segmentId`, segment name).
- [x] Show processed efforts counter and last checkpoint.
- [x] On completion, trigger refresh of segment detail/list counts.

---

## Phase 5: Testing

### 5.1 Integration tests (real DB, 3rd-party mocked)
- [ ] Add tests under `tests/integration/**` for:
  - segment search/autocomplete query path
  - sideline job creation and option persistence
  - effort ingestion for one target segment across pages ✅ implemented
  - idempotent re-run (no duplicate efforts)
  - rate-limit pause/resume continuation from checkpoint

### 5.2 Unit tests (all dependencies mocked)
- [ ] Add service-level tests for:
  - request validation
  - strategy fallback logic
  - checkpoint progression
  - error mapping

### 5.3 E2E tests
- [ ] Add E2E scenario under `tests/e2e/**`:
  - user types segment name, picks autocomplete option, starts sideline sync, sees progress and completion
- [x] Keep all waits/timeouts <= `30_000` ms.

---

## Phase 6: Documentation

- [ ] Document sideline sync behavior in `docs/services.md` (new section).
- [ ] Add UX notes in relevant docs (dashboard/sync flow).
- [ ] Document Strava endpoint constraints and quotas (with official links) used by segment-targeted effort sync.
- [x] Update this action plan as phases are completed.
- [x] Ensure all documentation changes carry date stamp `YYYY-MM-DD`.

---

## Phase 7: Deployment

### 7.1 Local rollout
- [x] Apply migration with data-safe workflow: `supabase db push` (not required for implemented approach)
- [x] Run targeted manual verification on one known segment with many attempts.

### 7.2 Quality gates (required)
- [x] `yarn lint`
- [x] `yarn tsc --noEmit`
- [x] `yarn test`
- [x] `yarn test:e2e`

### 7.3 Production rollout
- [ ] Deploy migration first, then app code.
- [ ] Monitor sideline job completion rate and errors.
- [ ] Validate no duplicate `effort_id_text` rows introduced.

---

## Progress Tracking

**Overall Status:** Implementation complete locally. Production rollout pending.

### Phase Completion
- [x] Phase 1: Overview & Scope
- [x] Phase 2: Database Layer
- [x] Phase 3: Backend Layer
- [x] Phase 4: Frontend Layer
- [ ] Phase 5: Testing
- [ ] Phase 6: Documentation
- [ ] Phase 7: Deployment

### Blockers
- None for local implementation and validation.

### Notes
- Keep implementation minimal and reuse existing sync orchestration and UI polling patterns.
- Favor existing segment catalog for autocomplete source; avoid introducing new tables unless strictly required.
- Final implementation reused `segment_efforts_only` jobs with `options.targetSegmentId`; no new enum value was required.
- Remaining scope for full plan completion: dedicated integration tests for API/UI start flow, E2E sideline scenario, and services docs updates.
