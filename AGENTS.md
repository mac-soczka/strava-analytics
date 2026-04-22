# Agent Instructions - Strava Heatmap

**Last Updated:** 2026-04-22

This file provides AI agents with project-specific guidelines for working on the Strava Heatmap codebase.

## 📚 Documentation Map

- [docs/README.md](docs/README.md) — Complete documentation index
- [docs/architecture.md](docs/architecture.md) — System architecture and design patterns
- [docs/testing-strategy.md](docs/testing-strategy.md) — Testing guidelines

## 🎯 Core Principles

### 1. Documentation-First Workflow
- **Before planning or implementation**, read relevant files in `docs/` for the feature being changed
- If docs are missing or conflicting, call that out explicitly and proceed with the safest minimal change
- For any documentation-related change, include an explicit date stamp (format: `YYYY-MM-DD`)

### 2. Minimalism & Simplicity
- **Make the most minimalistic set of changes** to meet requirements
- **Always strive for the simplest solution**: fewer fields, tables, and code paths beat clever generalizations
- Prefer one clear flag or column over parallel representations (e.g., timestamp + derived boolean + provenance string)
- When in doubt, choose the smaller design and document the trade-off

### 3. Package Manager
- **Always use `yarn`** for dependency management and scripts
- Avoid `npm`, `pnpm`, and other package managers unless explicitly requested

### 4. Quality Gates (Required)
Every action plan must include explicit tasks for:
1. **Linting**: `yarn lint`
2. **TypeScript type checking**: `yarn tsc --noEmit`
3. **Integration tests**: `yarn test`
4. **E2E tests**: `yarn test:e2e`

## 🏗️ Architecture References

- [docs/architecture.md](docs/architecture.md) — System architecture, layering, and design patterns
- [docs/design-patterns.md](docs/design-patterns.md) — Implemented patterns and best practices
- [docs/services.md](docs/services.md) — Service layer (Strava API integration)
- [docs/crawler-architecture.md](docs/crawler-architecture.md) — Background data synchronization system

## 🚀 Setup & Configuration

- [docs/environment-setup.md](docs/environment-setup.md) — Environment variables and runtime configuration
- [docs/local-development-guide.md](docs/local-development-guide.md) — Complete local setup guide
- [docs/local-supabase-setup.md](docs/local-supabase-setup.md) — Local Supabase configuration
- [docs/development-setup.md](docs/development-setup.md) — Development workflow
- [docs/strava-oauth-troubleshooting.md](docs/strava-oauth-troubleshooting.md) — OAuth integration issues

## 🧪 Testing References

- [docs/testing-strategy.md](docs/testing-strategy.md) — Comprehensive testing guidelines
- [docs/testing-without-triggers.md](docs/testing-without-triggers.md) — Database testing strategies

## Supabase

- Any change to **`supabase/migrations/*.sql`** (tables, columns, indexes, functions, triggers) requires creating a new migration file and applying it.
- **Local development:** Run **`supabase db reset`** to apply all migrations to your local database.
- **Production:** Use **`supabase db push`** to apply migrations to cloud (after testing locally).
- Create new migrations with **`supabase migration new <description>`**, then edit the generated SQL file.
- See [docs/migration-guide.md](docs/migration-guide.md) and [docs/supabase-commands.md](docs/supabase-commands.md) for detailed workflows.

## Tests for every change

- For substantive code changes (features, bug fixes, refactors that alter behavior): add or update **integration** tests under **`tests/integration/**`** and, when the change affects UX, navigation, or multi-step flows, **E2E** tests under **`tests/e2e/**`**. Skip only for purely mechanical edits (comments, formatting) when behavior is unchanged.
- **Timeouts (integration + E2E):** **Never** set any test or wait **above 30 seconds** (`30_000` ms). That is the **hard ceiling** in **`jest.config.js`** and **`playwright.config.ts`** — **do not raise it**. **Prefer** much shorter waits; see [docs/testing-strategy.md](docs/testing-strategy.md) (Timeouts).

## Mocking policy

- **Default:** avoid mocks. Prefer real collaborators and real infrastructure documented for this repo.
- **E2E (Playwright):** do **not** mock application code or HTTP to our own APIs. E2E runs against a real app instance and configured backends; see [docs/testing-strategy.md](docs/testing-strategy.md).
- **Integration tests:** use a **real Postgres** database (see [docs/testing-strategy.md](docs/testing-strategy.md)). For code paths that use Strava API, integration tests should exercise those **real** services (sandbox/test credentials), not mocked `fetch`.
- **Unit tests only:** mocks are allowed **only** to isolate a **single function or small pure unit** when testing that unit in isolation is the goal. Do not mock internal modules broadly to make an integration-style test "pass"; that belongs in **`tests/integration/**`** with real boundaries instead.

Keep this file as an index; place detailed guidance in `docs/` where it already exists (links above).
