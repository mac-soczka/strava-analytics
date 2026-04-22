## Strava-first Domain Model (DDD baseline)

**Last Updated:** 2026-04-22

This project’s core domain model is **Strava’s domain model**. When we talk about “entities” in this codebase, we mean **the entities defined by Strava’s API**, and we aim to keep our internal representations **structurally close** to Strava’s own schemas.

- **Primary reference**: Strava API Reference `https://developers.strava.com/docs/reference/`
- **Rate limits**: Strava Rate Limits `https://developers.strava.com/docs/rate-limits/`

### Principles

- **Strava is canonical**: Our entity field names, nesting, and types should follow Strava as closely as practical.
- **Extensions are explicit**: When we add project-specific fields, they should be additive and clearly separated (db columns, derived fields, or wrapper types), not silent mutations of Strava shapes.
- **Store IDs as Strava IDs**: When Strava provides an `id` (activity id, segment id, effort id), we preserve it as-is.
- **Avoid “almost-Strava”**: Don’t invent new concepts where Strava already has one (e.g. “effort” vs `SegmentEffort`).

### Canonical TypeScript shapes in this repo

Our baseline Strava entity shapes live in:

- `types/strava.d.ts`

These types should be treated as the “domain contracts” for Strava-originated data.

## Main Entities (Strava-defined)

Below are the primary entities we currently build around (in roughly the same grouping as Strava’s reference docs).

### Athlete

- **Meaning**: A Strava user (“athlete”) whose data we sync.
- **Strava endpoints**: `Athletes` section in the reference docs.
- **Local persistence**: `users` table (keyed by `strava_id`).

### Activity

- **Meaning**: A recorded workout/event.
- **Strava endpoints**:
  - `GET /athlete/activities` (list)
  - `GET /activities/{id}` (details)
- **Canonical type**: `StravaActivity`
- **Local persistence**: `activities` table, where:
  - `activity_id` = Strava activity `id`
  - `strava_id` = owner athlete id

### Segment

- **Meaning**: A named portion of road/trail with leaderboard context.
- **Canonical type**: `StravaSegment`
- **Local persistence**: `segments` table (keyed by Strava `segment_id`).

### SegmentEffort

- **Meaning**: An attempt at a segment inside an activity.
- **Canonical type**: `StravaSegmentEffort`
- **Local persistence**:
  - `segment_efforts` table keyed by Strava effort id (`effort_id`)
  - links: `activity_id` (Strava activity id) + `segment_id` (Strava segment id)

### Streams (StreamSet)

- **Meaning**: Time series telemetry for activities/routes/segments (latlng, time, distance, heartrate, watts, etc.).
- **Strava endpoints**: `Streams` section.
- **Local persistence**: project-specific (store only what we need; avoid storing everything by default).

### Lap

- **Meaning**: Lap/split segments within an activity.
- **Strava endpoints**: `List Activity Laps`.
- **Local persistence**: project-specific (store only what we need; avoid storing everything by default).

### Route

- **Meaning**: Saved route/course.
- **Strava endpoints**: `Routes` section.
- **Local persistence**: project-specific (store only what we need; typically polyline + metadata).

## How we extend Strava entities (project-specific)

We extend Strava’s model in three common ways:

1. **Persistence wrappers**
   - Example: `DatabaseActivity` mirrors `StravaActivity` but includes db fields like `strava_id`, `created_at`, `updated_at`.
2. **Derived fields**
   - Example: `strava_url` can be derived from the Strava id instead of stored everywhere.
3. **Domain services**
   - Example: `StravaService` orchestrates fetching and normalization, but should not “invent” new entity shapes.

## Rate limit data is also part of the domain contract

Rate limit state must be read from **HTTP response headers** on every Strava call:

- `X-RateLimit-Limit` and `X-RateLimit-Usage` (plus read variants)

See Strava’s docs: `https://developers.strava.com/docs/rate-limits/`

## Practical guidance (what to do when adding new features)

- **Need a new entity?** Start by finding it in Strava’s reference docs and adding a matching type in `types/strava.d.ts` before adding new tables/UI.
- **Need a new field?** Prefer:
  - (a) fields Strava already supplies, then
  - (b) explicit extension fields in our db/types.
- **Need to rename a field?** Don’t; keep Strava naming in domain types and map at boundaries only if needed.

