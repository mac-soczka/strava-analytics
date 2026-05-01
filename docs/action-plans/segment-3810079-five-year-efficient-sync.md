# Action Plan: Request-efficient 5-year sync for segment 3810079

**Last Updated:** 2026-05-01  
**Status:** 🟡 In Progress (core backend implemented locally)

## Phase 1: Overview & Scope

**Goal**: Fetch and persist all available efforts for segment `3810079` across the last 5 years, with strict request efficiency and restart safety.

**What success looks like**
- `segment_efforts` contains the full 5-year history for `segment_id = 3810079` (subject to Strava account/API visibility).
- Re-runs fetch only new/changed data and do not duplicate rows.
- Sync can pause/resume across rate limits and process restarts.

**Included**
- Segment-targeted 5-year backfill strategy
- Incremental daily catch-up strategy after backfill
- Checkpointed/restart-safe execution
- Clear progress visibility in `sync_jobs`

**Excluded**
- Broad “all segments” backfill
- Streams, laps, and non-segment entities

**Constraints**
- Strava rate limits apply (15-minute and daily budgets).
- `GET /segments/{id}/all_efforts` may be unavailable (`402`) for some accounts.

**Official references**
- [Strava API reference](https://developers.strava.com/docs/reference/)
- [Strava rate limits](https://developers.strava.com/docs/rate-limits/)

---

## Phase 2: Database Layer

### 2.1 Add minimal checkpoint state (one row per user+segment)
- [x] Create migration: `segment_target_sync_state` table with:
  - `strava_id` (bigint, not null)
  - `segment_id` (bigint, not null)
  - `mode` (`backfill` | `incremental`)
  - `backfill_before_epoch` (nullable bigint)
  - `incremental_after_epoch` (nullable bigint)
  - `last_activity_id` (nullable bigint)
  - `updated_at` (timestamp)
- [x] Add unique key: `(strava_id, segment_id)`.
- [x] Keep existing `segment_efforts.effort_id_text` uniqueness as idempotency source of truth.

### 2.2 Indexes for efficient reads/writes
- [x] Ensure/confirm indexes:
  - `segment_efforts(segment_id, start_date desc)`
  - `activities(strava_id, start_date desc)`
  - optional: `segment_efforts(segment_id, activity_id)`

---

## Phase 3: Backend Layer

### 3.1 Endpoint strategy (simple and strict)
- [x] Attempt direct endpoint first:
  - `GET /segments/3810079/all_efforts` with paging when available.
- [x] If direct endpoint returns `402`, use fallback:
  - List activities in time windows (`/athlete/activities` with `before/after`)
  - Fetch details per candidate activity (`/activities/{id}?include_all_efforts=true`)
  - Keep only efforts where `effort.segment.id === 3810079`

### 3.2 Request-efficient 5-year fallback
- [x] Split 5 years into monthly windows (oldest to newest).
- [x] For each window:
  - page through activity summaries (cheap list calls)
  - fetch details once per activity
  - persist only matching efforts
- [x] Record window/activity checkpoint after each page to allow exact resume.

### 3.3 Two operating modes
- [x] **Backfill mode** (one-time): cover entire 5-year range.
- [x] **Incremental mode** (daily): use `incremental_after_epoch` and 1-day overlap to fetch only recent deltas.

### 3.4 Budget guardrails
- [x] Enforce per-run request budget (e.g. configurable max requests per run).
- [ ] Pause job on budget depletion or 429 and set `resume_at`.
- [x] Persist progress every page so resume restarts from last stable checkpoint.

---

## Phase 4: Frontend Layer

### 4.1 Keep UI simple
- [ ] Reuse existing sideline sync panel for segment `3810079`.
- [ ] Add explicit mode label in progress:
  - `Backfill (5y)` or `Incremental (recent)`
- [ ] Show window progress (example: `2023-07 window, page 3`).

### 4.2 Operator controls
- [ ] Keep existing `Start`, `Cancel`, `Restart`.
- [ ] Add optional “Continue backfill” action that resumes from checkpoint.

---

## Phase 5: Testing

### 5.1 Integration tests (DB real, third-party mocked)
- [x] Fallback path (`402` from segment endpoint) processes monthly windows correctly.
- [ ] Checkpoint resume restarts from saved window/page, not from the beginning.
- [ ] Idempotent rerun does not create duplicate efforts.
- [ ] Incremental mode only fetches recent data after backfill completion.

### 5.2 Unit tests
- [ ] Window boundary calculation (5-year slicing).
- [ ] Budget depletion and pause behavior.
- [ ] Progress counters and state transitions.

### 5.3 E2E tests
- [ ] Start sideline sync for `3810079`, verify progress and completion states.
- [ ] Cancel and resume flow from UI.
- [ ] Keep all waits/timeouts <= `30_000` ms.

---

## Phase 6: Documentation

- [x] Update `docs/services.md` with the final endpoint order and fallback behavior.
- [x] Document why fallback requires activity-detail calls when segment endpoint is unavailable.
- [ ] Document expected request cost for 5-year backfill vs daily incremental.
- [ ] Keep date stamps updated (`YYYY-MM-DD`).

---

## Phase 7: Deployment

### 7.1 Rollout
- [x] Apply migration safely with `supabase db push`.
- [ ] Run one controlled backfill for `3810079` in staging/local.
- [ ] Verify checkpoint resume after intentional interruption.

### 7.2 Quality gates (required)
- [x] `yarn lint`
- [x] `yarn tsc --noEmit`
- [x] `yarn test`
- [x] `yarn test:e2e`

### 7.3 Production verification
- [ ] Confirm effort count increases over time and no duplicate effort IDs.
- [ ] Confirm jobs pause/resume correctly under rate limits.
- [ ] Confirm incremental mode keeps data current with low daily request cost.

---

## Practical execution order

- [x] Implement checkpoint table + migration
- [x] Implement monthly-window fallback with resume
- [ ] Add mode/progress UI labels
- [x] Add integration coverage for fallback + resume
- [x] Run full quality gates
- [ ] Execute 5-year backfill, then switch to incremental daily runs
