# Action Plan: Automatic Resume After Rate-Limit Pause

**Last Updated:** 2026-05-02  
**Status:** Not Started

## Phase 1: Overview & Scope

**Goal**
- Ensure sync jobs paused for Strava rate limits resume automatically when `resume_at` is reached.
- Remove the need for manual calls to `/api/sync/resume-paused` during local and production operation.

**Problem statement (current behavior)**
- Jobs correctly transition to `paused` with a computed `resume_at`.
- In practice, jobs may remain paused indefinitely unless someone manually triggers the resume endpoint.
- This causes long-running full syncs to stall and breaks expected unattended behavior.

**In scope**
- Reliable trigger mechanism that periodically resumes ready paused jobs.
- Idempotent resume execution (safe under duplicate trigger attempts).
- Observability for queued/resumed/failed resume attempts.
- UX clarity that paused jobs are waiting and will resume automatically.

**Out of scope**
- Changes to Strava request budgeting math.
- Major redesign of sync UI beyond status clarity.
- Rewriting full orchestration architecture.

**Dependencies**
- Existing `sync_jobs.resume_at` and `status='paused'` fields.
- Existing `get_paused_jobs_ready_to_resume` RPC usage.
- Existing `/api/sync/resume-paused` handler and `SyncOrchestrationService.resumeJob()`.

**Estimated effort**
- 0.5-1.5 days implementation + validation across at least one real pause/resume cycle.

---

## Phase 2: Database Layer

### 2.1 Resume eligibility correctness
- [ ] Verify `get_paused_jobs_ready_to_resume` selection logic:
  - `status = 'paused'`
  - `resume_at <= now()`
  - excludes cancelled/completed jobs.
- [ ] Confirm timezone handling uses UTC consistently for `resume_at`.

### 2.2 Concurrency safety
- [ ] Add or verify locking semantics (minimal approach):
  - use transactional status transition (`paused` -> `running`) before resume starts, or
  - lock row selection in RPC to prevent double-resume by concurrent workers.
- [ ] Add/verify indexes for efficient resume polling:
  - `(status, resume_at)` on `sync_jobs`.

### 2.3 Resume event integrity
- [ ] Ensure each automatic resume attempt writes `sync_job_events` with:
  - event type (`rate_limit_resumed` or failure),
  - timestamp,
  - concise failure details (if any).

---

## Phase 3: Backend Layer

### 3.1 Trigger model (minimal, reliable)
- [ ] Implement one automatic trigger path for each environment:
  - Production: scheduled call (cron/platform scheduler) to `/api/sync/resume-paused`.
  - Local development: lightweight interval worker (dev-only) or documented local scheduler command.
- [ ] Keep `/api/sync/resume-paused` as the single resume entrypoint to avoid duplicate logic.

### 3.2 Idempotent resume behavior
- [ ] Harden `resumeJob()` flow so duplicate invocations are no-op safe:
  - if already running/completed, return safely.
- [ ] Ensure resume starts from persisted checkpoint (`current_phase`, cursors, last processed ids).

### 3.3 Failure handling
- [ ] If resume fails, keep/return job to `paused` with a short retry backoff, not terminal failure by default.
- [ ] Add bounded retry policy for repeated transient failures.

### 3.4 Instrumentation
- [ ] Add structured logs for:
  - paused jobs found,
  - resumed count,
  - skipped count,
  - failed count with reason.
- [ ] Include job ids and `strava_id` in logs for quick diagnostics.

---

## Phase 4: Frontend Layer

### 4.1 Status clarity
- [ ] In sync status UI, show:
  - `Paused for rate limit`
  - `Will auto-resume at <resume_at>`
  - countdown (optional but preferred).

### 4.2 Polling behavior
- [ ] Keep status polling lightweight while paused (reduce interval if needed).
- [ ] Ensure UI transitions from `paused` to `running` without manual refresh.

### 4.3 Manual fallback UX
- [ ] Keep a manual resume affordance only as fallback, labeled clearly as rarely needed.

---

## Phase 5: Testing

### 5.1 Integration tests (DB real, 3rd-party mocked)
- [ ] Paused job with `resume_at` in past is picked and resumed by resume endpoint.
- [ ] Paused job with `resume_at` in future is not resumed.
- [ ] Duplicate trigger calls do not resume same job twice.
- [ ] Resume failure writes failure event and remains retryable.

### 5.2 Unit tests (all dependencies mocked)
- [ ] Resume worker loop logic (selection, counts, result aggregation).
- [ ] Idempotency guards in resume transition.
- [ ] Retry/backoff decision logic.

### 5.3 E2E tests
- [ ] Simulate pause state and verify auto-resume path to running/completed.
- [ ] Verify no manual intervention is required in happy path.
- [ ] Keep all waits/timeouts <= 30,000 ms.

---

## Phase 6: Documentation

- [ ] Update `docs/services.md` with auto-resume lifecycle and trigger mechanism.
- [ ] Update `docs/api/sync-endpoints.md` with expected scheduler behavior for `/api/sync/resume-paused`.
- [ ] Update `docs/user-guides/sync-activities.md`:
  - paused jobs resume automatically after window reset,
  - manual resume is fallback only.
- [ ] Document local-development scheduler instructions in `docs/local-development-guide.md` (or appropriate setup doc).

---

## Phase 7: Deployment

### 7.1 Local rollout
- [ ] Enable local auto-resume trigger.
- [ ] Run one real pause/resume cycle and verify unattended continuation.

### 7.2 Quality gates (required)
- [ ] `yarn lint`
- [ ] `yarn tsc --noEmit`
- [ ] `yarn test`
- [ ] `yarn test:e2e`

### 7.3 Production rollout
- [ ] Deploy DB/index changes first (if added), then app updates.
- [ ] Configure scheduler with safe frequency (e.g., every 1 minute).
- [ ] Verify first 24h:
  - paused jobs resume without operator action,
  - no duplicate resume side effects,
  - no unexpected failure loops.

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
- None currently; environment-specific scheduler choice (platform vs app-level dev worker) pending implementation decision.

### Notes
- Keep implementation minimal: one canonical resume endpoint + one scheduler trigger path.
- Prioritize idempotency and locking before adding optimization.
