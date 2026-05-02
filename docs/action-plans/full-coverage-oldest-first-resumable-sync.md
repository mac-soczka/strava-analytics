# Action Plan: Full-Coverage Oldest-First Resumable Sync

**Last Updated:** 2026-05-02  
**Status:** Implementation Complete (Local)

## Phase 1: Overview & Scope

**Goal**
- Fetch complete data for a user in a request-efficient way:
  - all activities
  - all segment efforts for those activities
  - segment catalog derived from those efforts
- Run oldest-first for backfill work.
- Pause/resume safely across Strava rate limits without restarting from scratch.

**Problem statement (current behavior)**
- Sync can complete with low/zero processed counts when page/order/cursor logic exits early.
- Existing UI progress can show completion even when no additional historical work was performed.

**In scope**
- Deterministic oldest-first backfill path for activity discovery and segment-effort completion.
- DB-persisted checkpoints for full job continuation.
- Request budgeting and pause/resume behavior for 15-minute and daily limits.
- Clear phase and cursor visibility in status APIs and UI.

**Out of scope**
- New Strava entities (streams/laps/comments/kudos).
- Major dashboard redesign unrelated to sync clarity.

**Dependencies**
- Existing `sync_jobs`, `sync_job_events`, `strava_sync_state`.
- Existing segment effort idempotency constraints.
- Existing rate limit service/header parsing.

**Estimated effort**
- 1-2 days implementation and validation + multi-day natural completion for large accounts under daily quota.

---

## Phase 2: Database Layer

### 2.1 Checkpoint and state integrity
- [x] Verify `sync_jobs` has required persisted checkpoint fields:
  - `current_phase`
  - `cursor_before_epoch`
  - `cursor_after_epoch` (for incremental mode)
  - `last_processed_activity_id`
  - rate-limit counters/reset timestamps
- [x] Add migration only if any required field is missing.

### 2.2 Activity completeness model
- [x] Standardize activity-level completion fields:
  - `segments_fetch_status` in (`pending`, `success_empty`, `success_rows`, `failed`)
  - `segments_fetched`, `segments_fetched_at`
  - `segment_efforts_synced_at`, `segments_effort_rows_count`
- [x] Add/verify indexes for oldest-first pending queries:
  - `strava_id`, `segments_fetch_status`, `segments_fetched`, `start_date`.

### 2.3 Persistence for continuation
- [x] Ensure pause writes include the latest cursor/checkpoint before status transitions to `paused`.
- [x] Ensure resume reads persisted cursor/checkpoint only (no in-memory assumptions).

---

## Phase 3: Backend Layer

### 3.1 Request-efficient endpoint strategy (mandatory)
- [x] Use `GET /athlete/activities` for discovery (paged).
- [x] Use `GET /activities/{id}?include_all_efforts=true` as the canonical call to persist:
  - activity details
  - segment efforts
  - embedded segment summary data
- [x] Avoid per-segment effort pagination endpoints for full-account sync.

### 3.2 Oldest-first execution strategy
- [x] Full sync activity discovery uses backfill cursor (`before`-based walk) until budget/limit stop.
- [x] Segment-effort completion queue is processed oldest-first from pending activities.
- [x] Remove/avoid shrinking-dataset pagination bugs (no offset skipping while mutating pending set).

### 3.3 Deterministic state machine
- [x] Enforce and persist phase transitions:
  - `discover_activities`
  - `ensure_segments`
  - `ensure_segment_efforts`
  - terminal states
- [x] Persist checkpoint after each batch and before pause.
- [x] Ensure resume continues exact phase + cursor from DB.

### 3.4 Rate-limit-safe continuation
- [x] Stop before breaching budgets (15m/day).
- [x] Persist `resume_at` and exact cursor on pause.
- [x] Resume jobs from saved checkpoint without re-scanning completed windows.

### 3.5 Completion criteria
- [x] Job is not marked completed until:
  - no discoverable older activities remain within selected backfill scope, and
  - no pending segment-effort activities remain.

---

## Phase 4: Frontend Layer

### 4.1 Accurate progress semantics
- [x] Show phase names matching backend state:
  - "Backfilling activities (oldest-first)"
  - "Ensuring segments"
  - "Ensuring segment efforts"
- [x] Show persisted cursor/checkpoint metadata in debug/status surfaces.

### 4.2 Pause/resume UX clarity
- [x] Show explicit paused reason, `resume_at`, and continuation point.
- [x] Keep active job hydration stable across refresh/navigation.
- [x] Prevent false "completed" perception when no work was executed (show "No new work in this window" when applicable).

---

## Phase 5: Testing

### 5.1 Integration tests (DB real, 3rd-party mocked)
- [x] Oldest-first ordering for pending segment-effort activities.
- [x] Backfill cursor progression over multiple pages/windows.
- [x] Pause on simulated 429 + resume from exact cursor.
- [x] No offset-skip regression while pending set shrinks.
- [x] Idempotency: rerun does not duplicate segment efforts.

### 5.2 Unit tests (all dependencies mocked)
- [x] Phase transition guards.
- [x] Budget/pause decision logic.
- [x] Cursor update logic and terminal completion detection.

### 5.3 E2E tests
- [x] Start full sync, observe phase transitions and non-zero progress for expected fixtures.
- [x] Refresh during running/paused state and verify continuation.
- [x] Resume path reaches completion without restart from scratch.
- [x] Keep all waits/timeouts <= 30,000 ms.

---

## Phase 6: Documentation

- [x] Update `docs/services.md` with canonical "all efforts from activity details" policy.
- [x] Update `docs/api/sync-endpoints.md` with phase/cursor fields and pause/resume semantics.
- [x] Update `docs/user-guides/sync-activities.md` with oldest-first + multi-day continuation behavior.
- [x] Add troubleshooting note for "0/N completed" outcomes and diagnostic steps.

---

## Phase 7: Deployment

### 7.1 Local rollout
- [x] Apply any migration via `supabase db push` (non-destructive).
- [ ] Run one long sync and force a pause/resume cycle to validate continuation.

### 7.2 Quality gates (required)
- [x] `yarn lint`
- [x] `yarn tsc --noEmit`
- [x] `yarn test`
- [x] `yarn test:e2e`

### 7.3 Production rollout
- [ ] Deploy schema first (if needed), then app changes.
- [ ] Monitor active jobs, pause/resume rates, and completion latency.
- [ ] Verify no user backfill restarts from scratch after rate-limit pauses.

---

## Progress Tracking

**Overall status:** Implementation complete and locally validated. One live-account long-run validation remains.

### Phase checklist
- [x] Phase 1: Overview & Scope
- [x] Phase 2: Database Layer
- [x] Phase 3: Backend Layer
- [x] Phase 4: Frontend Layer
- [x] Phase 5: Testing
- [x] Phase 6: Documentation
- [ ] Phase 7: Deployment

### Blockers
- Live-account long-run pause/resume validation is still pending manual execution in an authenticated environment.

### Notes
- Keep implementation minimal and deterministic: DB state is source of truth for continuation.
- Prioritize correctness + continuation over aggressive optimization; optimization must not compromise resumability.
- Local quality gates run on 2026-05-02:
  - `yarn lint` (warnings only, no blocking errors)
  - `yarn tsc --noEmit`
  - `yarn test`
  - `yarn test:e2e` (3 passed, 10 skipped in current environment)
