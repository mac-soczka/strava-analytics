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
- **Document your findings**: When researching external APIs, libraries, or systems:
  - Create or update documentation in `docs/` folder
  - Include official documentation links
  - Document rate limits, quotas, and constraints
  - Add examples and best practices
  - Update `docs/README.md` index if adding new doc

### 2. Minimalism & Simplicity
- **Make the most minimalistic set of changes** to meet requirements
- **Always strive for the simplest solution**: fewer fields, tables, and code paths beat clever generalizations
- Prefer one clear flag or column over parallel representations (e.g., timestamp + derived boolean + provenance string)
- When in doubt, choose the smaller design and document the trade-off

### 3. Package Manager
- **Always use `yarn`** for dependency management and scripts
- **Never use `npm`** commands - always convert to `yarn` equivalents:
  - `npm install` → `yarn install` or `yarn`
  - `npm run <script>` → `yarn <script>`
  - `npm install <package>` → `yarn add <package>`
  - `npm install -D <package>` → `yarn add -D <package>`
- Avoid `pnpm` and other package managers unless explicitly requested by the user

### 4. Quality Gates (Required)
Every action plan must include explicit tasks for:
1. **Linting**: `yarn lint`
2. **TypeScript type checking**: `yarn tsc --noEmit`
3. **Integration tests**: `yarn test`
4. **E2E tests**: `yarn test:e2e`

### 5. Logging Guidelines
- **Use the logger utility** (`lib/utils/logger.ts`) for all application logging
- Logs are written to both console AND file (`logs/sync-YYYY-MM-DDTHH-MM-SS.log`)
- **Never use emojis in log output** - they clutter logs and cause encoding issues
- Use plain text for all console.log, logger.log, logger.warn, logger.error
- Rate limits should use the special `logger.rateLimit()` method for formatted output
- Log files are automatically excluded from git via `.gitignore`

### 6. Emoji Usage Policy
- **Avoid emojis in code** - Do not add emojis to:
  - Console logs
  - Error messages
  - Log files
  - Code comments
  - Variable names
- **Emojis are acceptable only in**:
  - User-facing UI text (sparingly)
  - Documentation markdown (for visual hierarchy)
  - Commit messages (optional, not required)
- **Rationale**: Emojis cause issues with log parsing, terminal compatibility, and professional output

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
- **Local development (preserve data):** Prefer **`supabase db push`** (or `supabase migration up`) to apply new migrations **without dropping** your local database.
- **Local development (destructive):** Use **`supabase db reset`** only when you explicitly want a clean slate (it **drops local data**).
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

## 📋 Action Plan Guidelines

**Last Updated:** 2026-04-22

### Purpose

Action plans are comprehensive, executable roadmaps for implementing features. They ensure:
- Complete full-stack coverage (database → backend → frontend → tests)
- Nothing is forgotten (migrations, tests, docs, deployment)
- Progress can be tracked with checkboxes
- Time estimates are realistic
- Quality gates are enforced

### When to Create an Action Plan

Create a detailed action plan for:
- ✅ New features (user-facing or backend)
- ✅ Major refactors affecting multiple layers
- ✅ Complex integrations (external APIs, background jobs)
- ✅ Multi-day work requiring coordination

Skip for:
- ❌ Bug fixes (unless they require schema changes)
- ❌ Documentation-only changes
- ❌ Simple UI tweaks

### Action Plan Structure (7 Phases)

Every action plan must include these phases in order:

1. **Overview & Scope**
   - Clear goal statement
   - User flow (for user-facing features)
   - What's included vs excluded
   - Dependencies and prerequisites
   - Total time estimate

2. **Database Layer**
   - Migrations with RLS policies
   - Indexes for performance
   - Helper functions/triggers
   - Enum types
   - Data validation

3. **Backend Layer**
   - TypeScript types/interfaces
   - Repository classes (data access)
   - Service classes (business logic)
   - API route handlers
   - Error handling

4. **Frontend Layer**
   - Component hierarchy
   - State management
   - Loading/error states
   - Accessibility
   - Integration with pages

5. **Testing**
   - Integration tests (repos, services, APIs)
   - E2E tests (user flows)
   - Test data setup/teardown
   - No timeouts > 30 seconds

6. **Documentation**
   - Update relevant docs in `docs/`
   - API documentation
   - User guides (if applicable)
   - Inline code comments

7. **Deployment**
   - Quality gates (lint, tsc, test, test:e2e)
   - Local migration testing
   - Production migration
   - Deployment verification
   - Monitoring setup

### Common Patterns

**Background Job System** (sync, reports, bulk ops):
- Job queue table → Job repository → Orchestration service → API routes → UI components → Real-time updates → Error recovery

**Data Synchronization** (external APIs):
- API client → Sync service → Repository → Progress tracking → Incremental sync → Error handling

**CRUD Feature**:
- Database table → Repository → API routes → Form component → List component → Detail component → Tests

### Key Principles

1. **Full Stack**: Every plan covers all layers (database → backend → frontend → tests)
2. **Actionable**: Use checkboxes for every task
3. **Incremental**: Each phase can be completed independently
4. **Realistic**: Include time estimates for each phase
5. **Test-Driven**: Tests are part of the plan, not optional
6. **Quality Gates**: Always include lint, tsc, test, test:e2e
7. **Bottom-Up**: Build database first, then backend, then frontend

### File Location

Save detailed action plans in: `docs/action-plans/[feature-name].md`

Example: `docs/action-plans/user-triggered-sync.md`

### Progress Tracking

Each action plan should include:
- Overall status (Not Started, In Progress, Completed)
- Phase completion checkboxes
- Blockers section
- Notes section
- Last updated timestamp

### Anti-Patterns to Avoid

❌ Skip testing → ✅ Include integration and E2E tests  
❌ No RLS policies → ✅ Always add RLS for user data  
❌ UI before API → ✅ Build bottom-up (database → backend → frontend)  
❌ Mock everything → ✅ Use real database and services  
❌ No error states → ✅ Handle loading, error, empty states  
❌ Deploy untested → ✅ Run all quality gates first

---

Keep this file as an index; place detailed guidance in `docs/` where it already exists (links above).
