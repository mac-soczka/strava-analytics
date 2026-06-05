# Action Plan: Minimal Vercel Strava Sync for All Users

**Last Updated:** 2026-06-05  
**Status:** 🟡 In Progress (plan only)

---

## Phase 1: Overview & Scope

**Goal**
- Make Strava fetching in Vercel production as simple as possible while still eventually fetching full history for every signed-up user.
- Prevent duplicate fetch work so we preserve Strava quota (`100/15min`, `1000/day`).

**Current-state findings (from existing code/docs)**
- Request-efficient endpoint choice already exists: use `GET /athlete/activities` + `GET /activities/{id}?include_all_efforts=true`.
- Idempotent persistence already exists via upserts and DB unique constraints.
- Existing sync orchestration is feature-rich (recent/backfill/full-refetch modes, multiple progress paths).

**Simplification target**
- Keep **one** production algorithm and one scheduler entrypoint.
- Remove optional paths from runtime execution path (keep legacy paths only until migration is complete).
- Guarantee at-most-once active sync per user and avoid re-fetching unchanged activities.

**In scope**
- Production sync algorithm simplification.
- Duplicate-work prevention at DB + orchestration levels.
- Vercel scheduling model for unattended all-user sync.

**Out of scope**
- New product features unrelated to sync correctness.
- Segment leaderboard enrichment and non-essential Strava entities.

**Dependencies**
- Existing `sync_jobs`, `strava_sync_state`, repositories, and `StravaSyncService`.
- Vercel cron/scheduled invocation of a single sync tick endpoint.

**Estimated effort**
- 1-2 days implementation + 1 day hardening/validation.

---

## Phase 2: Database Layer

### 2.1 Enforce one active sync job per user (hard dedupe)
- [ ] Add a partial unique index on `sync_jobs(strava_id)` for active statuses (`queued`, `running`, `paused`) to prevent race-created duplicates.
- [ ] Keep existing application-level active job checks, but treat DB constraint as source-of-truth safety net.

### 2.2 Keep one minimal cursor model per user
- [ ] Normalize `strava_sync_state` usage to only required fields:
  - [ ] `activities_after` (recent frontier)
  - [ ] `backfill_cursor_before` (historical frontier)
  - [ ] `last_full_backfill_at` (completion marker)
- [ ] Remove unused or redundant cursor fields from active algorithm path.

### 2.3 Ensure duplicate row protection remains strict
- [ ] Verify and keep unique constraints for:
  - [ ] `activities(activity_id)`
  - [ ] `segments(segment_id)`
  - [ ] `segment_efforts` unique effort identity (`effort_id_text` or equivalent stable key)
- [ ] Keep upsert-only writes for sync entities.

### 2.4 Migration approach
- [ ] Create new migration(s) only (no edits to old migration files).
- [ ] Apply locally with `supabase db push` to preserve data.

---

## Phase 3: Backend Layer

### 3.1 Canonical minimal algorithm (single flow)
- [ ] Define one canonical sync flow for production:
  1) Discover activities (recent-first list fetch using `after`).
  2) Backfill older activities (`before` cursor) with remaining budget.
  3) For activities needing efforts, fetch details via `include_all_efforts=true`.
  4) Persist via idempotent upserts and mark checkpoints.
- [ ] Route all full-sync entrypoints to this one flow.

### 3.2 Single scheduler entrypoint for Vercel
- [ ] Introduce/standardize one endpoint (for example `/api/cron/sync-tick`) as the only production scheduler target.
- [ ] Each tick should:
  - [ ] select next eligible user (fair scheduling),
  - [ ] skip users with active jobs,
  - [ ] enqueue one job only.

### 3.3 Request budget guardrails (global + per-user)
- [ ] Add explicit budget checks before every Strava call using tracked header usage.
- [ ] Reserve safety headroom (for retries/token refresh).
- [ ] Stop gracefully before limit breach and pause/resume automatically.

### 3.4 Duplicate fetch prevention rules (minimal)
- [ ] Never fetch activity details if `segment_efforts_synced_at` exists and TTL says fresh.
- [ ] Stop list paging when a page is entirely known and older than recent window.
- [ ] Keep one deterministic ordering for pending work (no branchy strategy switches).

### 3.5 Vercel runtime safety
- [ ] Keep each tick bounded (small batch) to fit serverless execution limits.
- [ ] Persist progress after each batch so interrupted invocations are safe.

---

## Phase 4: Frontend Layer

### 4.1 Keep UI controls minimal
- [ ] Present one primary action: `Sync data`.
- [ ] Remove/hide strategy variants from normal UX (recent/backfill toggles stay internal).

### 4.2 Clear progress and dedupe visibility
- [ ] Show current phase only (`Discovering activities`, `Fetching segment efforts`, `Paused for rate limit`).
- [ ] Show `next resume at` when paused.
- [ ] Show last successful sync timestamp per user.

### 4.3 Prevent user-triggered duplicate jobs
- [ ] Disable sync trigger while an active job exists.
- [ ] If clicked while active, return existing job status instead of creating another.

---

## Phase 5: Testing

### 5.1 Integration tests (`tests/integration/**`)
- [ ] DB constraint test: second active job for same `strava_id` fails deterministically.
- [ ] Orchestration test: scheduler tick does not enqueue duplicate job when one is active.
- [ ] Cursor test: recent + backfill cursors advance and resume correctly after interruption.
- [ ] Budget test: job stops/pause-resumes before exceeding effective limits.
- [ ] Dedupe test: re-running sync does not increase row counts unexpectedly.

### 5.2 E2E tests (`tests/e2e/**`)
- [ ] User starts sync and sees single active job state.
- [ ] Re-clicking sync during active job does not create duplicate job.
- [ ] Paused job auto-resumes and continues from checkpoint.
- [ ] UI reflects final completion with updated timestamp.
- [ ] Keep all waits/timeouts <= `30_000` ms.

### 5.3 Test data and dependencies
- [ ] Use real Postgres integration boundaries.
- [ ] Use the project-approved Strava testing approach consistently and document any policy conflicts before implementation.

---

## Phase 6: Documentation

- [ ] Update `docs/services.md` with the new single canonical production flow.
- [ ] Update `docs/crawler-architecture.md` with Vercel scheduler model and fairness policy.
- [ ] Add/refresh dedupe details in `docs/data-deduplication-strategy.md` for job-level dedupe.
- [ ] Include official references:
  - [ ] `https://developers.strava.com/docs/rate-limits/`
  - [ ] `https://developers.strava.com/docs/reference/`
- [ ] Keep date stamps updated on edited docs.

---

## Phase 7: Deployment

### 7.1 Rollout sequence
- [ ] Apply DB migration(s) first (`supabase db push`).
- [ ] Deploy backend simplification behind a temporary feature flag if needed.
- [ ] Enable Vercel cron for single scheduler endpoint.

### 7.2 Quality gates (required)
- [ ] `yarn lint`
- [ ] `yarn tsc --noEmit`
- [ ] `yarn test`
- [ ] `yarn test:e2e`

### 7.3 Production verification (first 24h)
- [ ] Confirm no duplicate active jobs per user.
- [ ] Confirm daily request consumption decreases or remains stable.
- [ ] Confirm users continue from checkpoints after rate-limit pauses.

---

## Progress Tracking

**Overall status:** Planning complete; implementation not started.

### Phase checklist
- [x] Phase 1: Overview & Scope
- [ ] Phase 2: Database Layer
- [ ] Phase 3: Backend Layer
- [ ] Phase 4: Frontend Layer
- [ ] Phase 5: Testing
- [ ] Phase 6: Documentation
- [ ] Phase 7: Deployment

### Blockers
- Clarify and unify test policy around live Strava vs mocked Strava usage in this repo before implementation starts.

### Notes
- This plan intentionally prioritizes operational simplicity over feature breadth.
- Under Strava daily limits, “fetch all history for all users” is expected to be progressive/multi-day for larger accounts.
