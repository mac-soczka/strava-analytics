# Changelog

All notable changes to this project are documented in this file.

## 2026-04-30

### Changed
- Refactored Strava sync architecture into clear layers:
  - `StravaApiClient` interface with `RealStravaApiClient` (network) and `MockStravaApiClient` (test-only).
  - `StravaSyncService` containing request-minimizing sync logic (testable without Strava).
  - `StravaService` as a backwards-compatible facade that composes the above.

### Documentation
- Removed outdated/duplicate optimized-sync implementation summary doc and updated docs to reflect the new service composition (`docs/services.md`, `docs/README.md`).

