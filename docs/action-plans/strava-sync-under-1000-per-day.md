# Action Plan: Strava sync strategy under 1000 requests/day

**Last Updated:** 2026-04-28  
**Status:** 🟡 In Progress (plan only)

## 📋 Phase 1: Overview & Scope

**Goal**: Reliably fetch and keep up-to-date:
- **Activities** (summary + selected detail fields)
- **Segments** (as encountered via segment efforts)
- **Segment efforts** (per-activity segment efforts)

…while strictly respecting Strava’s limits (**100 requests / 15 min** and **1000 requests / day**).

**Key constraint**: With a 1000/day cap, “fetch everything” for large accounts is inherently **multi-day**. The system must be resumable, budget-aware, and able to backfill gradually.

**What’s included**
- A concrete **endpoint strategy** that minimizes requests for activities + segments + segment efforts
- **Budgeting** + **pause/resume** + **multi-day backfill**
- Progress/reporting that clearly states the **entity type** being fetched

**What’s excluded (explicitly)**
- Streams, laps, comments, kudos, zones, uploads, clubs, gear (can be added later with separate budgets)
- Segment leaderboards / KOM data

**Dependencies / prerequisites**
- Strava OAuth working (existing)
- Rate limit parsing from headers (existing, see `docs/strava-rate-limits.md`)
- Background job / pause-resume infra (existing sync jobs)

**Estimated time**
- Strategy + DB/schema tweaks + orchestration changes: **0.5–1.5 days**
- Backfill time: **days to weeks**, depending on account size and chosen depth

---

## 🗄️ Phase 2: Database Layer

### 2.1 Normalize what we store (minimal, request-efficient)
- [ ] **Activities table** must store:
  - `activity_id`, `strava_id`, timestamps (`start_date`, `start_date_local`)
  - core metrics + `updated_at` bookkeeping
  - **sync checkpoints**:
    - `activity_synced_at` (when we last pulled summary/list data)
    - `activity_details_synced_at` (when we last called `GET /activities/{id}`)
    - `segment_efforts_synced_at` (when we last called `GET /activities/{id}?include_all_efforts=true`)
- [ ] **Segments table** must store what we can get “for free” from efforts:
  - segment id/name/distance/grades/location + polyline if available in the embedded segment object
  - Note: the embedded segment payload may be missing fields that only `GET /segments/{id}` provides; we should treat that as optional enrichment.
- [ ] **Segment efforts table** stores:
  - stable id as **TEXT** (already being addressed in this repo)
  - `(activity_id, segment_id, effort_id_text)` (or equivalent unique key) for idempotency

### 2.2 Add “sync frontier” state to avoid rescanning history
We need a per-user cursor so we don’t burn requests re-walking old pages every day.

- [ ] Add table (or extend existing user/profile table) `strava_sync_state` keyed by `strava_id`:
  - [ ] `activities_after` (epoch seconds) OR `last_seen_activity_start_date` (ISO)
  - [ ] `last_list_page_scanned` (optional; safer: use time-based boundary instead)
  - [ ] `backfill_cursor_before` (epoch seconds) for historical paging
  - [ ] `last_full_backfill_at` (timestamp)
  - [ ] `daily_budget_override` (optional)

### 2.3 Indexes
- [ ] Ensure fast “what needs syncing?” queries:
  - activities needing details / efforts (by `activity_details_synced_at` / `segment_efforts_synced_at`)
  - segment efforts uniqueness constraints (to prevent duplicate inserts)

---

## 🧠 Phase 3: Backend Layer (Strategy + Algorithms)

### 3.1 Golden rule: minimize Strava endpoints
For our entity set (activities, segments, segment efforts), the most request-efficient path is:

- **List activities**: `GET /athlete/activities` (paged)
- **For each activity that needs efforts**: `GET /activities/{id}?include_all_efforts=true`
  - This one call yields **segment efforts** and embedded **segment** objects.

Avoid (unless explicitly required later):
- `GET /segment_efforts?segment_id=...` (per-segment paging; can explode request count)
- `GET /segments/{id}` (per-segment enrichment; budget separately if needed)

### 3.2 Two-phase sync: “frontfill” then “backfill”
We split work so users get useful data quickly without exhausting daily quota.

#### A) Frontfill (recent-first, daily)
- [ ] Always prioritize last **N days** (configurable, e.g. 7–30).
- [ ] Fetch activity list pages until:
  - [ ] we exit the “recent window” OR
  - [ ] we see an activity we already have and it’s older than the window (stop early).
- [ ] For newly discovered activities:
  - [ ] store summary immediately
  - [ ] optionally fetch details/efforts immediately *if budget allows*

#### B) Backfill (historical, multi-day)
- [ ] Maintain `backfill_cursor_before` (epoch seconds).
- [ ] Each day, spend a fixed slice of quota on backfill.
- [ ] Continue paging older activities with `before=...` until budget is exhausted.

### 3.3 Request budgeting (hard daily cap)
We treat “requests” as a first-class budget with guardrails.

- [ ] Define budgets per job type:
  - **Activities list budget** (cheap discovery): e.g. 50–150 req/day
  - **Activity details+efforts budget** (1 req per activity): remainder (e.g. 700–900 req/day)
  - Reserve: 20–50 req/day for retries / token refresh / safety

**Rule of thumb**:
- One `GET /activities/{id}?include_all_efforts=true` = **one activity’s segment efforts**.
- Therefore, max activities whose efforts we can fetch per day is roughly:
  \[
  \text{effort_activities_per_day} \approx \text{daily_budget_for_details}
  \]

### 3.4 Stop conditions to prevent waste
- [ ] **List scanning stop**: stop when a full page contains only already-known activities *and* they’re older than the frontfill window.
- [ ] **Details stop**: skip `GET /activities/{id}` if:
  - [ ] `segment_efforts_synced_at` is recent enough (within TTL), and
  - [ ] we already have effort rows for that activity (idempotent check)

### 3.5 TTLs (avoid refetching stable history)
- [ ] Activities older than X days (e.g. 30) rarely change; set:
  - [ ] `activity_details_ttl_old = 30d` (or “never” unless user requests refresh)
  - [ ] `efforts_ttl_old = 365d` (or “never”)
- [ ] For recent activities (e.g. last 7 days):
  - [ ] shorter TTL (e.g. refetch efforts 1–3 times) to capture late processing / device uploads

### 3.6 Make entity type explicit in orchestration + logs
This repo already has sync job types; extend/standardize so every step states entity type:
- [ ] When listing `/athlete/activities`: log **“Fetching activities”**
- [ ] When calling `/activities/{id}?include_all_efforts=true`: log **“Fetching segment efforts (and segments)”**

---

## 🧩 Phase 4: Frontend Layer (User-visible strategy)

### 4.1 Sync options that map to budgets
- [ ] Add UI affordances (simple presets):
  - [ ] **“Sync recent activities”** (frontfill only; low budget)
  - [ ] **“Continue backfill”** (spends daily backfill allocation)
  - [ ] **“Refresh segment efforts for last 7 days”** (small targeted job)

### 4.2 Progress should always name entity type
- [ ] Progress UI must display current entity:
  - “Syncing activities…”
  - “Syncing segment efforts…”
  - “Syncing segments…” (only when we explicitly run segment enrichment jobs)

---

## 🧪 Phase 5: Testing

### 5.1 Integration tests (rate limit + budgeting)
- [ ] Add integration tests for:
  - [ ] budget enforcement (job stops before exceeding remaining daily quota)
  - [ ] stop conditions (don’t scan beyond first “all known” page)
  - [ ] TTL rules (skip refetching old activities)

### 5.2 E2E tests (happy path)
- [ ] Start “recent sync” and verify:
  - [ ] progress indicates **activities** then **segment efforts**
  - [ ] pause/resume works on 429

---

## 📚 Phase 6: Documentation

- [ ] Add a short doc explaining:
  - [ ] why “full history” is multi-day under 1000/day
  - [ ] what endpoints we use and why
  - [ ] how frontfill/backfill works
  - [ ] what “segments” means in our app (derived from segment efforts unless enriched)

Include references:
- [ ] `docs/strava-rate-limits.md`
- [ ] Strava official rate limits: `https://developers.strava.com/docs/rate-limits/`
- [ ] Strava API reference: `https://developers.strava.com/docs/reference/`

---

## 🚀 Phase 7: Deployment (Quality Gates)

Before shipping:
- [ ] Run `yarn lint`
- [ ] Run `yarn tsc --noEmit`
- [ ] Run `yarn test`
- [ ] Run `yarn test:e2e`

---

## Notes / Strategy summary (high-signal)

- **Best single call for “segments + segment efforts”**: `GET /activities/{id}?include_all_efforts=true`
- **Do not** attempt to fetch all efforts by segment (`/segment_efforts?segment_id=...`) if the goal is “all efforts across all activities” — it’s request-expensive and subscription-gated.
- **Under 1000/day**, correctness comes from:
  - idempotent upserts
  - stable cursors/checkpoints
  - explicit budgets + stop conditions
  - pause/resume at both 15-min and daily windows

