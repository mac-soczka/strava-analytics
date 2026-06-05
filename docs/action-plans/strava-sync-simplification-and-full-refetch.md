# Action Plan: Strava sync simplification, full refetch, and JSON HTTP logging

**Status:** Not Started  
**Last updated:** 2026-05-03  

## 1. Overview and scope

### Goal

Replace the current multi-column, activity-centric sync state machine with a **simpler model**: log every Strava HTTP exchange as JSON, **refetch all activities**, derive **segments and segment efforts** with a **minimal request budget**, and **drop redundant sync metadata columns** from `activities`, `segments`, and `segment_efforts` (and related RPCs/jobs UI) so only **essential** persistence remains.

### User-facing flow

1. User triggers a **full resync** (one job type; clear messaging: may take days under rate limits).
2. Progress shows coarse phases: activities enumerated, activity details fetched, efforts persisted.
3. On failure, logs on disk contain enough JSON to reproduce/debug without guessing.

### In scope

- Structured **request + response JSON** logging to **terminal** and **append-only log files** (with **token redaction** and **size limits** for huge bodies).
- **Full activity refetch** strategy (pagination + per-activity detail passes as defined below).
- **Request-minimal** strategy for segments/efforts (documented; implemented in services).
- **Schema reduction**: remove sync-specific columns and related DB functions/RPCs that only served the old state machine, after a **compat migration** period if needed.

### Out of scope (initial phase)

- Real-time Strava webhooks.
- Incremental “delta only” sync (can be phase 2 once full refetch is stable).
- Storing raw Strava payloads in Postgres (logs only unless explicitly decided).

### Dependencies

- Strava API: [Rate limits](https://developers.strava.com/docs/rate-limits/) (15-min and daily caps; respect `Retry-After`).
- Existing repos: `ActivitiesRepository`, `SegmentsRepository`, `StravaService` / `StravaApiClient`, job tables.

### Time estimate (order of magnitude)

- Logging + redaction: 0.5–1 day  
- Sync algorithm swap + refetch job: 2–4 days  
- Schema cleanup + migrations + RPC removal: 2–3 days  
- Tests + docs + E2E: 2–3 days  

---

## 2. Clarify data strategy (request minimization vs “every segment / every effort”)

**Important:** “For every activity fetch all segments” and “for every segment fetch all segment efforts” **must not** be implemented as naive N+1 calls to segment and effort list endpoints, or the account will exceed limits quickly.

### Recommended canonical approach (min requests)

| Step | Strava call | What it returns |
|------|-------------|-----------------|
| A | `GET /athlete/activities` (paged) | Activity list (summaries). |
| B | `GET /activities/{id}?include_all_efforts=true` | **One call per activity**: full detail + **all segment efforts** for that activity + **embedded segment** objects. |

This satisfies **(3)** and **(4)** for **this athlete’s** efforts: segments encountered on activities and efforts are taken from **B**, not from per-segment effort pagination.

### When per-segment effort endpoints are needed

Only for **gaps** that cannot come from the user’s activities (e.g. efforts on segments **not** present in any stored activity detail, or explicit “catalog completeness” product requirements). If required, batch by segment and **strictly budget** calls; document in `docs/services.md`.

### Alignment with goals

- **(5) Minimize requests:** Primary path = **1 list page + 1 detail per activity** (detail only when list row is new or forced refetch).
- **(2) Refetch all activities:** Re-run **A** for all pages; for each activity id, re-run **B** (or skip **B** if hash/updated_at unchanged—optional optimization in phase 2).

---

## 3. Database layer

### 3.1 Inventory and remove redundant columns

**Principle:** Keep columns required for **app features** (heatmap, lists, deduplication, FKs) and **one** optional “last synced” marker if needed; remove parallel “sync state” encodings.

- [ ] Audit `activities`, `segments`, `segment_efforts` for sync-only columns, for example (names may vary; confirm in current migrations):
  - Activity: `activity_sync_state`, `activity_sync_started_at`, `activity_sync_completed_at`, `activity_sync_error`, `activity_sync_attempts`, `segments_fetch_status`, `segments_fetch_error`, `segments_fetched`, `segments_fetched_at`, `segment_efforts_synced_at`, `segments_effort_rows_count`, etc.
  - Any similar **duplicate** timestamps vs `updated_at` / `activity_details_synced_at`—collapse to **one** source of truth if retained.
- [ ] Define **minimal retained set** (example; finalize in design review):
  - Activities: Strava identifiers, core fields, **optional** `details_fetched_at` or `last_strava_detail_at` (single column).
  - Segments: identity + geometry/names as needed by UI.
  - Segment efforts: dedupe key (`effort_id_text` or equivalent), FKs, times—**no** separate “sync status” per row if not needed.
- [ ] New migration(s): `DROP COLUMN` (or deprecate: nullable + stop writing, then drop in follow-up migration per `docs/migration-guide.md`).
- [ ] Drop or replace RPCs/views that reference removed columns (`claim_next_activity_for_segment_sync`, queue preview/counts, `active_sync_job_state` if tied only to old model—evaluate).

### 3.2 Jobs / checkpoints (keep simple)

- [ ] Prefer **job row + JSON checkpoint** (`last_activity_id`, `page`, `phase`) over many activity-row status columns.
- [ ] If `sync_jobs` / events are sufficient, **do not** duplicate checkpoint into `activities`.

### 3.3 RLS and indexes

- [ ] Rebuild indexes dropped with columns; ensure upsert paths still use unique constraints documented in `sync-dedupe-and-id-safety`.

---

## 4. Backend layer

### 4.1 JSON HTTP logging

- [ ] Implement a single **Strava HTTP interceptor** (in `StravaApiClient` or equivalent) that for each call emits:
  - `timestamp`, `method`, `url` (path + query; **no** secrets in URL), `request_headers_redacted`, `request_body` if any, `response_status`, `response_headers` (rate limit headers preserved), `response_body` (JSON parsed or truncated string).
- [ ] **Redact:** `Authorization`, refresh/access tokens, cookies.
- [ ] **Truncate:** responses above N KB (configurable); log `truncated: true` and length.
- [ ] **Dual sink:** `getLogger()` (file) + `console` (development); use existing `lib/utils/logger.ts` patterns; **no emojis** in log lines (per `AGENTS.md`).
- [ ] Log file naming: e.g. `logs/strava-http-YYYY-MM-DDTHH-MM-SS.jsonl` or one session file with NDJSON lines.

### 4.2 Sync orchestration (simplified)

- [ ] One orchestration path: **Full refetch** job:
  1. Paginate activities (A); upsert summaries as needed.
  2. For each activity (order configurable: oldest/newest), fetch detail (B); upsert activity; upsert segments from efforts; upsert efforts idempotently.
  3. Respect rate limits; pause job with `resume_at` when 429 or budget exhausted.
- [ ] Remove or bypass old phase machine (`discover_activities` / `ensure_segments` / multiple column transitions) in favor of **job checkpoint + phase enum** only on the job row.
- [ ] **Idempotency:** upserts only; safe to rerun.

### 4.3 API routes

- [ ] Expose **one** “start full refetch” endpoint (or repurpose `/api/sync/start` with explicit `mode=full_refetch` in body).
- [ ] `/api/sync/status` returns job + checkpoint only (trim `exactState` if queue RPCs removed).
- [ ] Update or remove endpoints that depended on dropped columns.

---

## 5. Frontend layer

- [ ] Simplify **SyncStatusWidget** / dashboard copy: phases match new job model; remove duplicate “activity queue vs segments queue” if server no longer exposes dual RPCs—or replace with single “Backfill progress” list driven by job checkpoint.
- [ ] Ensure **Start / Cancel / Resume** still work with simplified job state.

---

## 6. Testing

- [ ] **Integration tests:** use **mock Strava client** (per user rule: integration hits DB; mock third-party)—assert request counts per activity (exactly one detail call per activity in happy path).
- [ ] **Unit tests:** JSON logger redaction and truncation.
- [ ] **E2E (if UX changes):** start job, see progress, cancel—under existing Playwright timeouts (`docs/testing-strategy.md`).
- [ ] Quality gates: `yarn lint`, `yarn tsc --noEmit`, `yarn test`, `yarn test:e2e`.

---

## 7. Documentation

- [ ] Update `docs/services.md`: canonical endpoints (A/B), when not to call segment-effort list APIs.
- [ ] Update `docs/README.md` index (this plan).
- [ ] Short **runbook**: where logs live, how to grep a failing `activity_id`, rate-limit behavior.

---

## 8. Deployment

- [ ] Apply migrations locally with `supabase db push` (preserve data) or reset only if intentional (`docs/migration-guide.md`).
- [ ] Verify production log volume; consider **log rotation** or **DEBUG_STRAVA_HTTP=true** flag for full JSON in prod.
- [ ] Post-deploy: spot-check one user refetch; confirm effort counts vs Strava sample.

---

## Blockers / risks

- **Rate limits:** Full refetch for large accounts is multi-day; product must set expectations.
- **Strava payload size:** Very large `include_all_efforts` responses may need truncation in logs and careful DB batching.
- **Column removal:** Coordinate with any external scripts or analytics using old columns.

## Notes

- This plan **supersedes** the direction of older plans that added many activity-level sync columns; those plans remain historical reference until this plan is executed.
- **2026-05-03:** Initial draft from product request (JSON logging, full refetch, minimal columns, min requests).
