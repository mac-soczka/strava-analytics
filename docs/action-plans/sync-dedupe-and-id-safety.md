# Action Plan: Sync dedupe + Strava ID safety

**Last Updated:** 2026-04-27  
**Status:** 🟡 Planned

## Overview

**Goal**: Ensure “sync all” reliably completes in the correct sequence and does not re-fetch/re-insert data without a clear reason:

1) **Activities are fetched and persisted**  
2) **Segment lists are fetched per activity** and we record whether the fetch succeeded (including the valid empty list case)  
3) **Segment effort rows are persisted exactly-once** (no silent duplicates), and effort IDs are stored without JS precision loss

## Problem statement (root causes)

### A) Strava segment effort ids exceed JS safe integer range

Strava segment effort ids can be larger than \(2^{53}-1\). When parsed into a JS `number`, they become **imprecise**, breaking:
- dedupe (upsert keys),
- lookups by id,
- “already fetched” checks.

### B) `segments_fetched` is an insufficient completion signal

`activities.segments_fetched` is currently used to decide whether we should fetch segment lists again. But we can end up in states like:
- `segments_fetched=true` and **0** `segment_efforts` rows for that activity (inconsistent)
- `segments_fetched=false` and **valid empty** results (causes repeated fetch attempts forever)

## Success criteria

- ✅ We can store and query a segment effort id like `3483138966280148748` **exactly**, and dedupe works.
- ✅ For a given activity:
  - we fetch segment list at most once **unless** (a) it failed, (b) user triggers repair/backfill, or (c) we explicitly detect inconsistencies.
  - “empty list” is treated as a successful fetch (no repeated work).
- ✅ “Sync all” can be re-run and stays **idempotent**: no duplicate effort rows and no unnecessary refetch loops.
- ✅ We can explain every re-fetch via **explicit status** and/or a **sync job event** entry.

---

## Phase 1 — Database changes (migrations)

### 1.1 Add explicit segment-fetch status per activity (replace boolean semantics)

- [ ] Create migration `supabase/migrations/*_add_activity_segment_fetch_status.sql`
- [ ] Add columns to `activities`:
  - [ ] `segments_fetch_status TEXT NOT NULL DEFAULT 'pending'`
    - allowed values: `pending | success_empty | success_rows | failed`
  - [ ] `segments_fetched_at TIMESTAMPTZ`
  - [ ] `segments_fetch_error TEXT`
  - [ ] `segments_effort_rows_count INTEGER` (optional, but useful for integrity checks)
- [ ] Backfill from existing data:
  - [ ] If `segments_fetched=true` and there are `segment_efforts` rows for that activity → `success_rows`
  - [ ] If `segments_fetched=true` and there are **0** rows → `success_empty` (only if we previously observed empty fetches) OR `pending` (safer default)
  - [ ] If `segments_fetched=false` → `pending`
- [ ] Keep `segments_fetched` temporarily for backward compatibility (remove later).

### 1.2 Fix effort id type safety

Pick one of these approaches (recommended: **TEXT id**):

- [ ] **Option A (recommended)**: change `segment_efforts.effort_id` from `BIGINT` to `TEXT`
  - [ ] Create migration `*_segment_effort_id_to_text.sql`
  - [ ] Add `effort_id_text TEXT`
  - [ ] Backfill `effort_id_text = effort_id::text`
  - [ ] Add constraint `UNIQUE(effort_id_text)`
  - [ ] Update upsert conflict targets to use `effort_id_text`
  - [ ] (Later) drop old `effort_id` column when code no longer uses it

- [ ] Option B: keep DB as `BIGINT`, but treat ids as strings in application code and only cast at the DB boundary
  - Risk: JS must never parse them as numbers; all parsing/serialization must be string-safe.

### 1.3 Integrity checks for “done but empty”

- [ ] Add a view or function to detect inconsistent activities:
  - `segments_fetch_status IN ('success_rows')` but 0 rows
  - `segments_fetch_status IN ('success_empty')` but rows exist
- [ ] Add an index on `segments_fetch_status` for queue scans.

---

## Phase 2 — Backend code changes

### 2.1 Parse Strava IDs safely

- [ ] Update Strava entity typing in `types/strava.d.ts`:
  - [ ] represent `SegmentEffort.id` as `string` (or `string | number` during transition, but prefer string)
- [ ] In `lib/services/strava-service.ts`:
  - [ ] ensure any id used for persistence is treated as **string** (never `number`) once it can exceed safe range.
  - [ ] ensure we don’t stringify rounded numbers; prefer the raw JSON representation.

### 2.2 Make segment list fetch state machine explicit

- [ ] Update `ActivitiesRepository`:
  - [ ] replace `getActivitiesNeedingSegments*` queries to use `segments_fetch_status='pending' OR 'failed'`
  - [ ] add:
    - `markSegmentsFetchSuccessEmpty(activityDbId)`
    - `markSegmentsFetchSuccessRows(activityDbId, rowCount)`
    - `markSegmentsFetchFailed(activityDbId, error)`
- [ ] Update `StravaService.syncSegments()`:
  - [ ] when Strava returns 0 efforts → mark `success_empty`
  - [ ] when >0 efforts persisted → mark `success_rows` (and store row count)
  - [ ] on non-rate-limit errors → mark `failed` with error text
  - [ ] on rate limit → do not mark as success; rely on orchestration pause/resume

### 2.3 Exactly-once persistence for effort rows

- [ ] Update `SegmentsRepository` upsert strategy:
  - [ ] use a **single stable unique key** (`effort_id_text` or equivalent)
  - [ ] avoid `UNIQUE(activity_id,segment_id)` as the only conflict key if multiple distinct efforts can exist per activity+segment (Strava uses effort id as identity).

---

## Phase 3 — API and UI (visibility + repair)

### 3.1 Expose consistency / repair tooling (minimal, auditable)

- [ ] Add an API route to “re-queue segment fetch” for a specific activity:
  - `POST /api/sync/repair/activity-segments/:activityId`
  - sets `segments_fetch_status='pending'` and clears error fields
  - logs a `sync_job_events` entry with the reason

### 3.2 UX indicators

- [ ] Show segment fetch coverage based on `segments_fetch_status` (not the legacy boolean).
- [ ] When an activity is in `failed`, surface a message and provide “retry” action (calls repair route).

---

## Phase 4 — Testing

### 4.1 Unit tests (mock dependencies)

- [ ] `StravaService`:
  - [ ] does not refetch segments when status is success*
  - [ ] marks `success_empty` on empty result
  - [ ] marks `failed` on error

### 4.2 Integration tests (real DB)

- [ ] Create `tests/integration/sync-segment-fetch-status.test.ts`
  - [ ] inserts an activity row, runs segment sync with stubbed Strava response (or controlled fixture) and asserts correct status transitions

### 4.3 E2E smoke (optional)

- [ ] Start a sync job and verify progress reaches completion without re-queueing already completed activities.

---

## Phase 5 — Documentation + rollout

- [ ] Update `docs/domain-driven-design.md` (sync invariants + status machine)
- [ ] Update `docs/api/sync-endpoints.md` with the new repair endpoint (if added)
- [ ] Add a short “Why ids are strings” section in `docs/domain-model-strava.md`

---

## Deployment / Quality gates

- [ ] `yarn lint`
- [ ] `yarn type-check`
- [ ] `yarn test`
- [ ] `yarn test:e2e`
- [ ] Apply migrations locally: `yarn db:push`

