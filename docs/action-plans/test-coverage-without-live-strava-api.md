# Action Plan: Test Coverage Without Live Strava API

**Status:** Not Started  
**Last Updated:** 2026-05-03  
**Owner:** AI agent + maintainer

## 1) Overview & Scope

Goal: increase automated coverage for sync workflows while avoiding any live Strava API traffic during tests, so rate limits are preserved.

Included:
- Unit tests for sync orchestration and Strava service coordination logic.
- Integration tests against real local Postgres/Supabase DB with mocked third-party Strava client responses.
- E2E tests that validate dashboard sync UX behavior using internal app APIs only.
- Shared test fixtures/builders to keep tests simple and reusable.

Excluded:
- New production features unrelated to testing.
- Performance/load testing against live Strava endpoints.
- Increasing any timeout above 30 seconds.

Dependencies:
- Existing local Supabase setup and seeded auth test users.
- Stable mock strategy for `StravaApiClient` in test runtime.

Estimated total: **1.5-2.5 days**.

## 2) Database Layer

Estimate: **2-3 hours**

- [ ] Confirm no schema migration is required; keep DB schema unchanged.
- [ ] Define deterministic DB fixture setup for sync tests (activities in `pending`, `in_progress`, `failed`, `completed` states).
- [ ] Add reusable DB test helpers for creating queue states without duplication.
- [ ] Ensure fixture teardown keeps database clean between tests.
- [ ] Validate row-level assumptions used by queue/status APIs.

## 3) Backend Layer

Estimate: **4-6 hours**

- [ ] Add/expand test seams so services consume `StravaApiClient` mocks in tests.
- [ ] Add unit tests for `SyncOrchestrationService` phase transitions (`discover_activities`, `ensure_segments`, `ensure_segment_efforts`, `completed`, `failed`).
- [ ] Add unit tests for cancellation and paused/resume behavior.
- [ ] Add unit tests for queue claim ordering (`oldest`/`newest`) and retry behavior (`pending` before `failed`).
- [ ] Add integration tests for `/api/sync/status/[jobId]` to verify queue payload updates over time without live Strava calls.
- [ ] Add integration tests for `/api/sync/start` + `/api/sync/cancel/[jobId]` to verify queue clearing and status consistency.

## 4) Frontend Layer

Estimate: **3-4 hours**

- [ ] Add component tests for `SyncStatusWidget` rendering of activity/segment queue counters and live lists.
- [ ] Add tests for progress fallback logic (avoid misleading `0/0` while active).
- [ ] Add tests for polling-driven updates in `useSyncStore` during `running` status.
- [ ] Add tests for cancelled-state queue UX (empty queues/lists).
- [ ] Verify start-order selector (`oldest`/`newest`) affects displayed queue sort in UI state.

## 5) Testing

Estimate: **4-6 hours**

- [ ] Add shared Strava mock fixtures (`activities`, `activity details`, `segment efforts`, `429 rate-limit responses`).
- [ ] Keep integration tests on real database while mocking all third-party Strava interactions.
- [ ] Add focused regression tests for "queue not updating" scenarios (same claimed activity repeated, stalled list ordering, stale progress text).
- [ ] Add E2E coverage for:
- [ ] Start sync -> queue list updates -> cancel sync -> queues empty.
- [ ] Oldest-first mode visibly advances queue ordering.
- [ ] Ensure all tests remain under 30,000 ms timeout ceiling.
- [ ] Avoid duplication by using common builders/factories for job state and queue rows.

## 6) Documentation

Estimate: **1-2 hours**

- [ ] Update `docs/testing-strategy.md` with "no live Strava API in tests" workflow and fixture examples.
- [ ] Document approved mock boundaries: mock third-party Strava client only; keep internal app logic real.
- [ ] Add "how to run test suites safely when rate-limited" section with exact commands.
- [ ] Add troubleshooting notes for flaky polling/UI sync tests.

## 7) Deployment

Estimate: **1 hour**

- [ ] Run `yarn lint`.
- [ ] Run `yarn tsc --noEmit`.
- [ ] Run `yarn test`.
- [ ] Run `yarn test:e2e`.
- [ ] Confirm no migration changes are pending.
- [ ] Open PR with test summary and explicit note: "No live Strava API calls in test runs."

## Blockers

- None currently.

## Notes

- Keep implementation simple: small fixtures, few helper layers, minimal abstractions.
- Prefer deterministic test data over random generators for reproducibility.
