# Action Plan: Activity-Centric Oldest-First Segment-Effort Sync

**Last Updated:** 2026-05-02  
**Status:** In Progress (implementation complete, manual validation/deployment pending)

## Phase 1: Overview & Scope

**Goal**
- Process activities strictly oldest to newest.
- For each activity:
  1. mark activity state as `in_progress`,
  2. fetch segments for that activity,
  3. fetch/persist segment efforts in the most request-efficient way,
  4. mark activity `completed` only when all segment-effort work for that activity is done.
- Avoid repeated requests and support safe pause/resume under Strava rate limits.

**Problem statement (current gap)**
- Existing flow can re-touch previously processed work when completion markers are incomplete or ambiguous.
- Pause/resume can appear to repeat segment/effort work.
- Need deterministic per-activity state transitions with explicit checkpoints.

**In scope**
- Activity-level state machine and DB schema/state updates.
- Oldest-first deterministic activity queue.
- Request-efficient segment/effort extraction strategy.
- Idempotency and anti-duplication guarantees.
- Rate-limit-safe continuation from exact state.

**Out of scope**
- Non-segment entities (streams/laps/comments/kudos).
- Dashboard redesign beyond status/state visibility.

**Dependencies**
- `activities`, `segments`, `segment_efforts`, `sync_jobs`, `strava_sync_state`.
- Existing Strava API client and rate-limit service.

**Estimated effort**
- 2-4 days implementation + validation against a real account with at least one forced pause/resume cycle.

---

## Phase 2: Database Layer

### 2.1 Activity state machine columns
- [x] Add/verify explicit activity sync fields:
  - `activity_sync_state` enum: `pending`, `in_progress`, `completed`, `failed`
  - `activity_sync_started_at`
  - `activity_sync_completed_at`
  - `activity_sync_error`
  - `activity_sync_attempts` (integer)
- [x] Keep segment-related markers aligned with activity state:
  - `segments_fetch_status`
  - `segments_fetched_at`
  - `segment_efforts_synced_at`
  - `segments_effort_rows_count`

### 2.2 Queue/index design
- [x] Add index for oldest-first pending fetch:
  - `(strava_id, activity_sync_state, start_date, activity_id)`
- [x] Add index for in-progress recovery scans:
  - `(strava_id, activity_sync_state, activity_sync_started_at)`

### 2.3 Idempotency constraints
- [x] Verify unique constraints to prevent duplicates:
  - segment uniqueness by `segment_id`
  - effort uniqueness by Strava effort id (`effort_id_text` / canonical ID field).
- [x] Add migration backfill to align existing rows with new state machine:
  - set `completed` for rows with successful segment+effort markers,
  - keep unresolved rows as `pending`.

---

## Phase 3: Backend Layer

### 3.1 Deterministic oldest-first activity loop
- [x] Implement queue fetch:
  - select next `pending` activity ordered by `start_date asc, activity_id asc`.
- [x] Before API work, atomically set activity to `in_progress` with timestamp and attempt increment.
- [x] On successful completion of all effort persistence for activity, set `completed`.
- [x] On non-rate-limit failure, set `failed` with error message.

### 3.2 Segment + segment-effort fetching strategy (request efficiency)
- [x] Primary approach per activity:
  - call `GET /activities/{id}?include_all_efforts=true` once,
  - derive all segments and all segment efforts from that payload.
- [x] Segment processing order may be any order in-memory, but persistence must be idempotent.
- [x] Optional endpoint strategy (only if demonstrably cheaper for targeted segment backfills):
  - use segment-all-efforts endpoints selectively with strict dedupe.

### 3.3 Avoid repeated requests
- [x] Skip API call if activity is already `completed`.
- [ ] For `in_progress` rows older than stale threshold (e.g. worker crash), requeue safely:
  - either retry from `in_progress` or reset to `pending` with audit event.
- [x] Persist per-activity checkpoint after each durable step:
  - details fetched,
  - segments upserted,
  - efforts upserted.

### 3.4 Pause/resume behavior
- [x] On rate limit hit, pause job and persist:
  - current activity id,
  - activity state (`in_progress`),
  - cursor/checkpoint fields and `resume_at`.
- [x] On resume, continue from:
  - current `in_progress` activity first (if present),
  - then oldest `pending`.
- [ ] No manual intervention required for scheduled resume trigger.

---

## Phase 4: Frontend Layer

### 4.1 Progress semantics
- [x] Show activity queue status:
  - total pending/in_progress/completed/failed counts.
- [x] Show current activity id/name and phase step:
  - `mark_in_progress`, `fetch_details`, `persist_segments`, `persist_efforts`, `mark_completed`.

### 4.2 Resume clarity
- [x] If paused, show `resume_at` and “will continue automatically”.
- [x] After resume, show it restarted from in-progress activity or next pending oldest activity.

### 4.3 Debug visibility
- [x] Add optional advanced diagnostics panel:
  - last processed activity,
  - requests used (15m/day),
  - duplicate-skip counters.

---

## Phase 5: Testing

### 5.1 Integration tests (DB real, 3rd-party mocked)
- [x] Oldest-first activity ordering is strict and stable.
- [x] Activity moves `pending -> in_progress -> completed` on success.
- [ ] Rate-limit pause during activity keeps resumable state and resumes same activity.
- [x] Duplicate segment/effort rows are not created on retries or restarts.
- [x] Failed activity path records error and does not block next activity indefinitely.

### 5.2 Unit tests (all dependencies mocked)
- [ ] State transition guards and illegal transition rejection.
- [ ] Retry and stale in-progress recovery policy.
- [x] Deduplication/upsert selection logic.

### 5.3 E2E tests
- [x] Start full sync and verify activity-by-activity progress.
- [ ] Force pause and verify automatic resume continuation.
- [ ] Verify completion with no manual resume endpoint call.
- [x] Keep all waits/timeouts <= 30,000 ms.

---

## Phase 6: Documentation

- [x] Update `docs/services.md` with activity-centric state machine and fetch strategy.
- [x] Update `docs/api/sync-endpoints.md` with new activity state fields and transitions.
- [x] Update user sync guide with “oldest-first activity queue” explanation.
- [x] Add troubleshooting section:
  - stuck `in_progress` activity,
  - repeated requests,
  - paused jobs not resuming.

---

## Phase 7: Deployment

### 7.1 Local rollout
- [x] Apply migration via `supabase db push`.
- [x] Backfill existing activities into new state fields.
- [ ] Run one real-account sync through a pause/resume cycle.

### 7.2 Quality gates (required)
- [x] `yarn lint`
- [x] `yarn tsc --noEmit`
- [x] `yarn test`
- [x] `yarn test:e2e`

### 7.3 Production rollout
- [ ] Deploy DB migration first, then app changes.
- [ ] Ensure auto-resume scheduler is active.
- [ ] Monitor first 24h:
  - completed activities/minute,
  - repeated-request rate,
  - duplicate insert conflicts,
  - paused-to-resumed latency.

---

## Progress Tracking

**Overall status:** Core implementation complete locally; remaining work is manual pause/resume validation and production rollout.

### Phase checklist
- [x] Phase 1: Overview & Scope
- [x] Phase 2: Database Layer
- [x] Phase 3: Backend Layer
- [x] Phase 4: Frontend Layer
- [ ] Phase 5: Testing
- [x] Phase 6: Documentation
- [ ] Phase 7: Deployment

### Blockers
- Final decision needed on stale `in_progress` timeout and retry budget policy.
- Manual real-account rate-limit pause/resume validation still pending.

### Notes
- Keep it simple and deterministic: one canonical activity state machine and idempotent writes.
- Default to one-request-per-activity (`include_all_efforts=true`) for best request efficiency.
- 2026-05-02: Implemented migration `20260502104500_add_activity_sync_state_machine.sql` and applied locally with `yarn db:push`.
- 2026-05-02: Added queue-state exposure to `/api/sync/status/[jobId]` under `exactState.activityQueue` and `exactState.currentActivity`.
