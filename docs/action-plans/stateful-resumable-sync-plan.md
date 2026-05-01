# Action Plan: Stateful Resumable Strava Sync

**Last Updated:** 2026-05-01  
**Status:** 🟢 Implementation Complete (Local)

---

## Phase 1: Overview & Scope

**Goal**: Implement a sync flow that can restart from any moment with all state persisted in database, processes data recent-first, guarantees completion of segment and segment-effort fetches, and exposes exact live sync state at all times.

**Core assumptions (must hold):**
- All sync state is in DB, not in-memory only.
- Process can crash/restart at any step and continue without losing position.
- Activity ingestion runs recent-first.
- For every discovered activity, segments must be fetched.
- For every fetched segment context, segment efforts must be fetched and persisted.
- Current sync state must be queryable exactly (job, phase, cursor, entity counts, last processed item).

**Included**
- DB-backed state machine for sync phases and checkpoints
- Rate-limit-aware orchestration (15-min and daily caps)
- Observable progress API and UI state
- Resume logic for crashes, deploys, worker restarts, and rate-limit pauses

**Excluded**
- New Strava entities outside activities, segments, and segment efforts
- Major redesign of existing dashboard UX

**Dependencies / prerequisites**
- Existing `sync_jobs`, `sync_job_events`, `strava_sync_state`, `activities` sync timestamp fields
- Existing pause/resume plumbing in `SyncOrchestrationService`

**Estimated implementation time**
- 1.5 to 3 days (implementation + tests + docs)

---

## Phase 2: Database Layer

### 2.1 Add explicit state-machine columns (minimal changes)
- [ ] Create migration: `yarn supabase migration new add_sync_state_machine_fields`
- [ ] Add `current_phase` to `sync_jobs` (enum/text):
  - `discover_activities`
  - `ensure_segments`
  - `ensure_segment_efforts`
  - `completed`
  - `failed`
- [ ] Add checkpoint fields to `sync_jobs`:
  - `last_processed_activity_id`
  - `last_processed_segment_id` (nullable, only if needed by implementation)
  - `strava_page`
  - `cursor_after_epoch`
  - `cursor_before_epoch`
  - `requests_used_15m`
  - `requests_used_daily`
  - `rate_limit_15m_reset_at`
  - `rate_limit_daily_reset_at`
- [ ] Keep one active job per user via partial unique index (`pending`, `running`, `paused`).

### 2.2 Track per-activity completeness
- [ ] Add/update activity-level sync state fields (reuse existing where possible):
  - `segments_fetch_status`
  - `segment_efforts_synced_at`
  - `segments_fetched_at`
  - `segments_effort_rows_count`
- [ ] Add deterministic statuses for idempotent resume:
  - `pending`
  - `success_empty`
  - `success_rows`
  - `failed`
- [ ] Add indexes for "next work item" queries.

### 2.3 Persist observable snapshots
- [ ] Extend `sync_job_events` usage with periodic `progress_snapshot` events containing:
  - phase
  - cursor
  - request budget usage
  - processed/failed counters by entity
- [ ] Add lightweight SQL view (or RPC) for exact current state:
  - one row per active job
  - includes job status + phase + checkpoints + budget state.

---

## Phase 3: Backend Layer

### 3.1 Implement resumable phase runner
- [ ] Refactor orchestration to execute by persisted `current_phase`.
- [ ] On each successful unit of work, persist checkpoint before moving on.
- [ ] On startup/resume, load latest active/paused job and continue from saved phase/checkpoint.

### 3.2 Enforce required sync order
- [ ] `discover_activities` (recent-first): fetch activity pages newest to oldest and upsert activities.
- [ ] `ensure_segments`: for activities still pending segment data, fetch details and persist segments.
- [ ] `ensure_segment_efforts`: persist all efforts from activity details (or equivalent endpoint if needed).
- [ ] Mark activity complete only when segment effort step has finished (`success_rows` or `success_empty`).

### 3.3 Rate-limit-safe execution
- [ ] Parse and persist Strava rate-limit headers per request.
- [ ] Stop before limit breach and set job to `paused` with `resume_at`.
- [ ] Resume worker continues at exact checkpoint after reset.
- [ ] Reserve safety budget for retries and token refresh.

### 3.4 Idempotency and retries
- [ ] Ensure all writes are upserts with stable keys.
- [ ] Retry transient failures with bounded attempts.
- [ ] Keep failed activity state in DB; allow repair/requeue without restarting whole sync.

---

## Phase 4: Frontend Layer

### 4.1 Exact sync-state visibility
- [ ] Update status endpoint payload to include:
  - `status`, `current_phase`
  - last processed IDs/cursors
  - request budget used + remaining
  - per-entity progress counters
- [ ] Show explicit phase text in UI:
  - "Fetching recent activities"
  - "Ensuring segments"
  - "Ensuring segment efforts"
  - "Paused for rate limit until <time>"

### 4.2 Resume-safe UX
- [ ] On page reload, rehydrate active job from API and continue polling.
- [ ] Show deterministic state (never ambiguous spinner-only state).
- [ ] Show last error reason and next resume time when paused/failed.

---

## Phase 5: Testing

### 5.1 Integration tests (DB real, Strava mocked)
- [ ] Add tests under `tests/integration/` for:
  - restart from each phase checkpoint
  - recent-first ordering
  - activity completeness guarantee (`segments` and `segment_efforts`)
  - pause/resume on simulated 429
  - idempotent reruns (no duplicates)
  - visibility query returns exact current state

### 5.2 Unit tests (all dependencies mocked)
- [ ] Add focused tests for:
  - phase transition rules
  - checkpoint advancement
  - retry/backoff decision logic
  - budget stop conditions

### 5.3 E2E tests
- [ ] Add flow tests under `tests/e2e/`:
  - user starts sync, sees phase transitions
  - hard refresh during sync, state resumes correctly
  - paused job resumes and completes
- [ ] Keep all waits/timeouts <= 30,000 ms.

---

## Phase 6: Documentation

- [ ] Add/refresh sync architecture section in `docs/crawler-architecture.md` with phase-state diagram.
- [ ] Document "state source of truth is DB" in `docs/services.md`.
- [ ] Add troubleshooting notes for rate-limit pauses and stuck checkpoints.
- [ ] Include examples of state payloads returned by status API.
- [ ] Update `docs/README.md` action plan index.

---

## Phase 7: Deployment

### 7.1 Local verification
- [ ] Apply migration safely: `supabase db push`
- [ ] Run one full sync and force restart mid-run to verify resume behavior.

### 7.2 Quality gates (required)
- [ ] `yarn lint`
- [ ] `yarn tsc --noEmit`
- [ ] `yarn test`
- [ ] `yarn test:e2e`

### 7.3 Production rollout
- [ ] Deploy schema changes first.
- [ ] Deploy app/services.
- [ ] Monitor active jobs, pause/resume counts, and completion latency.
- [ ] Validate no job exceeds limits and no activity remains indefinitely in `pending`.

---

## Progress Tracking

**Overall Status:** Implementation complete and locally verified. Production rollout remains.

### Phase Completion
- [x] Phase 1: Overview & Scope
- [x] Phase 2: Database Layer
- [x] Phase 3: Backend Layer
- [x] Phase 4: Frontend Layer
- [x] Phase 5: Testing
- [x] Phase 6: Documentation
- [ ] Phase 7: Deployment

### Blockers
- None for local implementation and validation.
- Production rollout steps still need to be executed in deployment environment.

### Notes
- Keep implementation minimal: reuse existing `sync_jobs`, `sync_job_events`, and `strava_sync_state`; avoid introducing unnecessary new tables.
- State transitions should be explicit and persisted on every meaningful step so restart behavior is deterministic.
- Quality gates executed locally on 2026-05-01:
  - `yarn lint` (warnings only, no errors)
  - `yarn tsc --noEmit`
  - `yarn test`
  - `yarn test:e2e` (deterministic local mode with live crawler E2E suites skipped)
