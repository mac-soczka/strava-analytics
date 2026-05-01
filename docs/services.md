# Services Documentation

This document describes the services layer of the StravaHeatmap application, which encapsulates business logic and external API integrations.

## 🏗️ Service Layer Overview

The service layer acts as an intermediary between the presentation layer (components) and the data access layer (repositories). It contains business logic, orchestrates data operations, and manages external API integrations.

## 📦 Available Services

### 1. Strava sync stack (Strava API + sync logic)

**Last Updated:** 2026-04-30

We separate responsibilities so **sync logic is testable without touching Strava**:

- **`StravaApiClient` (transport/integration)**: the *only* layer allowed to call Strava HTTP.
  - **Real implementation**: `lib/strava/real-strava-api-client.ts` (`RealStravaApiClient`)
  - **Mock implementation**: `lib/strava/mock-strava-api-client.ts` (`MockStravaApiClient`)
- **`StravaSyncService` (sync optimization/business logic)**: minimizes Strava requests and persists data via repositories.
  - Location: `lib/services/strava-sync-service.ts`
- **`StravaService` (facade/backwards compatibility)**: thin wrapper used by existing orchestration/routes.
  - Location: `lib/services/strava-service.ts`

#### Why this split?

- **Testability**: `StravaSyncService` can be tested with `MockStravaApiClient` (no network).
- **Clarity**: token refresh, rate-limit parsing, and HTTP concerns live in `RealStravaApiClient`.
- **Request minimization**: sync logic can enforce “**1 request per activity**” patterns centrally.

#### Interfaces and implementations

##### `StravaApiClient` (`lib/strava/strava-api-client.ts`)

Minimal API used by sync logic:

- `fetchActivities(page, perPage, { before?, after? })`
- `fetchActivityDetails(activityId)` (must use `include_all_efforts=true`)
- `fetchActivitySegmentEfforts(activityId)` (segment efforts extracted from activity details)

##### `StravaSyncService` (`lib/services/strava-sync-service.ts`)

Main entry points (all depend on `StravaApiClient`):

- `syncActivities(...)`
- `syncSegments(...)`
- `syncActivitiesRecent(...)`
- `syncActivitiesBackfill(...)`

##### `StravaService` (`lib/services/strava-service.ts`)

Facade that composes a real client and sync logic for existing code paths.

#### Request-minimizing rule (high-signal)

- **Segments + segment efforts** should be derived from:
  - `GET /activities/{id}?include_all_efforts=true`
- Avoid per-segment effort paging endpoints when the goal is “all efforts across activities”.

---

### 2. SyncOrchestrationService

**Purpose**: Creates background sync jobs, tracks progress, handles pause/resume on rate limits.

**Location**: `lib/services/sync-orchestration-service.ts`

**State model (DB is source of truth):**
- Sync execution state is persisted in `sync_jobs` and `strava_sync_state`.
- `sync_jobs.current_phase` tracks deterministic phase transitions:
  - `discover_activities`
  - `ensure_segments`
  - `ensure_segment_efforts`
  - `completed` / `failed`
- Checkpoints (`last_processed_activity_id`, cursors, and request-usage counters) are persisted so jobs can continue after process restart.
- `active_sync_job_state` view provides exact in-flight state for API/UI visibility.

---

## 🧪 Testing guidance (service layer)

- **Sync logic tests**: instantiate `StravaSyncService` with `MockStravaApiClient` (no Strava HTTP).
- **Transport tests**: keep them minimal; if you test `RealStravaApiClient`, it must be against a stubbed fetch (never real Strava).

This service layer provides a robust foundation for managing business logic and external integrations while keeping sync logic testable and request-efficient.