---
description: Make the dashboard visually richer with clearer color, temporal, trend, and stats cues
---

# Action Plan: Dashboard Visual Clues Refresh

**Last Updated:** 2026-04-29  
**Status:** 🔄 Not Started  
**Estimated Total Time:** 16-22 hours

---

## Overview & Scope

**Goal:** Make the dashboard feel instantly informative and visually compelling through strong temporal storytelling (month/year views), activity-type intelligence, geospatial context (heatmaps), and semantic color-driven trend cues.

**User Flow:**
1. User lands on dashboard and sees a clear “current period” summary (this month / this year).
2. User switches timeframe (month, quarter, year) and the full dashboard updates consistently.
3. User compares activity types (ride/run/hike/etc.) with clear distribution and performance deltas.
4. User explores geospatial intensity via map/heatmap to understand where efforts happen most.
5. User spots momentum, decline, and stale data immediately via color-coded trends and badges.

**Included:**
- Time model UX: month/year selectors, rolling windows, and period-over-period comparison labels
- Visual system for stat cards (color, badges, trend arrows, deltas, confidence cues)
- Activity type analytics section (distribution, totals, performance per type)
- Geospatial module (route density + effort hotspot heatmap)
- Chart stack redesign (monthly bars, trend lines, composition donuts, map overlays)
- Better hierarchy for primary vs secondary metrics
- Loading/empty/error states with clearer visual cues
- Accessibility and mobile responsiveness improvements

**Excluded:**
- New data ingestion pipelines from external providers
- Redesign of non-dashboard pages
- Major schema rework for unrelated domains

**Dependencies / Prerequisites:**
- Existing dashboard data loaders and types
- Design token alignment with current Tailwind patterns
- Test users with varied activity history (low/medium/high volume)
- Map layer capability already used by route components (reuse where possible)

**Visual Clues to Implement (Core):**
- Color semantics: success/improving, warning/flat, risk/declining
- Temporal context chips: "This month", "This year", "vs previous month/year"
- Trend direction: arrows + percentage delta + absolute delta
- Momentum strips/sparklines per key metric
- Activity type chips with rank change indicators (e.g., Ride moved to #1)
- Geospatial density cues (low/med/high intensity zones)
- Data quality indicators: stale, incomplete, or estimated badges
- Comparative stats: current period vs baseline

---

## Phase 1: Database Layer (Optional, Minimal)

**Estimated Time:** 1-2 hours

### 1.1 Confirm if new persisted aggregates are needed
- [ ] Validate whether existing queries can provide 7d/30d/90d deltas without schema changes
- [ ] If needed, add one minimal aggregate source (view/materialized view) for dashboard trend windows
- [ ] Keep schema changes minimal and avoid parallel metric representations

### 1.2 Migration and safety (only if required)
- [ ] Create migration via `supabase migration new dashboard_visual_trend_aggregates`
- [ ] Add indexes only if query plan justifies them
- [ ] Apply locally using `supabase db push` (non-destructive)
- [ ] Document rationale in migration SQL comments

---

## Phase 2: Backend Layer

**Estimated Time:** 2-3 hours

### 2.1 Extend dashboard data contracts
- [ ] Add typed structures for timeframe model (`month`, `quarter`, `year`, rolling windows)
- [ ] Add typed structures for trend deltas (value, percent, direction)
- [ ] Add typed structures for recency/staleness metadata
- [ ] Add typed structures for activity-type period comparisons
- [ ] Add typed structures for geospatial aggregates used by heatmaps
- [ ] Ensure null-safe handling for new users with sparse history

### 2.2 Update server data loaders
- [ ] Enhance `dashboard-activity-stats` loaders with month-over-month and year-over-year comparisons
- [ ] Add query paths for activity-type breakdown by timeframe
- [ ] Add aggregated geospatial buckets for heatmap rendering (minimal payload)
- [ ] Compute trend metadata server-side (not in component rendering)
- [ ] Add staleness metadata based on last sync timestamps

### 2.3 Error handling and fallbacks
- [ ] Return safe defaults when trend windows are incomplete
- [ ] Mark uncertain values as "insufficient data" instead of misleading zeros
- [ ] Preserve current dashboard behavior if new trend fields are absent

---

## Phase 3: Frontend Layer

**Estimated Time:** 4-5 hours

### 3.1 Visual system and color semantics
- [ ] Define dashboard-specific semantic color tokens (improving/flat/declining/stale)
- [ ] Apply consistent color mapping across cards, badges, and charts
- [ ] Ensure contrast/accessibility compliance in light/dark modes

### 3.2 Time period control + temporal framing
- [ ] Add timeframe control with clear options (`This Month`, `Last 3 Months`, `This Year`, `All Time`)
- [ ] Show active timeframe in a persistent badge near top KPIs
- [ ] Add "compared to" subtitle for each trendable card (e.g., vs previous month)
- [ ] Ensure switching timeframe updates cards, charts, activity types, and map together

### 3.3 Stat cards with trend clues
- [ ] Add delta chips on primary cards (e.g., `+8.4% vs last 30d`)
- [ ] Add directional icons (up/right/down) with neutral state support
- [ ] Add confidence or completeness markers for partial windows

### 3.4 Activity type storytelling
- [ ] Add activity-type composition chart (donut/stacked bar)
- [ ] Add per-type performance tiles (distance, time, elevation, avg pace/speed)
- [ ] Add trend delta per type so users can see which type is growing/declining

### 3.5 Geospatial + heatmap module
- [ ] Add map panel with activity density / effort hotspot layer
- [ ] Provide legend and intensity scale with semantic colors
- [ ] Add filter hooks for activity type + timeframe
- [ ] Keep payload lightweight (aggregated points/tiles only)

### 3.6 Chart system refresh
- [ ] Monthly bars for totals, trend lines for momentum, donut for activity composition
- [ ] Ensure all charts share consistent color semantics and tooltip language
- [ ] Use compact annotations for significant shifts (peaks/dips)

### 3.7 Layout hierarchy and responsiveness
- [ ] Emphasize top 3 KPIs visually; de-emphasize secondary stats
- [ ] Rebalance spacing and card grouping for faster scanning
- [ ] Verify mobile layout keeps trend clues readable (no overflow/clipping)

### 3.8 UX states
- [ ] Improve skeleton loading to match final layout density
- [ ] Add explicit empty-state cues for low-history accounts
- [ ] Improve error-state messaging and visual severity cues

---

## Phase 4: Testing

**Estimated Time:** 2-3 hours

### 4.1 Integration tests (`tests/integration/**`)
- [ ] Verify loader trend calculations for positive/negative/flat periods
- [ ] Verify month-over-month and year-over-year window selection logic
- [ ] Verify staleness classification logic (fresh/warning/stale)
- [ ] Verify sparse-data accounts return safe fallback values
- [ ] Verify activity-type breakdown calculations per timeframe
- [ ] Verify geospatial aggregation payload shape/limits
- [ ] Verify API/data contract compatibility with existing dashboard consumers

### 4.2 E2E tests (`tests/e2e/**`)
- [ ] Dashboard shows trend chips for populated data accounts
- [ ] Dashboard shows "insufficient data" cues for sparse accounts
- [ ] Timeframe switch updates visual clues correctly
- [ ] Activity-type charts/tables update correctly across timeframe changes
- [ ] Heatmap panel renders with legend and non-empty data
- [ ] Mobile viewport renders cards and trend cues correctly
- [ ] Loading and error states remain clear and accessible

### 4.3 Timeout and realism requirements
- [ ] Keep all waits/timeouts <= `30_000` ms
- [ ] Prefer real app + real DB boundaries (no broad app mocks)
- [ ] Use deterministic fixtures/seed data for trend assertions

---

## Phase 5: Documentation

**Estimated Time:** 1 hour

### 5.1 Update docs with visual clue system
- [ ] Add/Update dashboard UX guidance in `docs/` with examples of each clue type
- [ ] Document semantic color mapping and badge rules
- [ ] Document temporal comparison definitions (what "vs previous" means)
- [ ] Include date stamp for all updated docs (`YYYY-MM-DD`)

### 5.2 Action plan maintenance
- [ ] Track progress by checking boxes in this file
- [ ] Keep blockers and notes up to date
- [ ] Add execution summary to this plan when complete (no separate execution doc)

---

## Phase 6: Deployment

**Estimated Time:** 1-2 hours

### 6.1 Quality gates (required)
- [ ] `yarn lint`
- [ ] `yarn tsc --noEmit`
- [ ] `yarn test`
- [ ] `yarn test:e2e`

### 6.2 Local verification
- [ ] Run dashboard locally with seeded datasets (low/med/high activity)
- [ ] Validate visual clues across desktop and mobile
- [ ] Confirm no regressions in existing dashboard interactions

### 6.3 Production rollout
- [ ] If migrations exist, apply with `supabase db push`
- [ ] Deploy app and verify dashboard rendering
- [ ] Monitor logs for loader/query errors

---

## Phase 7: Monitoring & Iteration

**Estimated Time:** 1 hour initial + ongoing

### 7.1 Post-deploy checks
- [ ] Track dashboard usage and engagement with trend UI
- [ ] Watch for user confusion around delta semantics
- [ ] Validate stale-data badge frequency against actual sync cadence

### 7.2 Iteration backlog
- [ ] Tune color thresholds based on real usage
- [ ] Refine trend wording for clarity
- [ ] Add optional advanced mode for deeper temporal comparisons
- [ ] Add per-region geospatial comparison (city/zone clustering)

---

## Progress Tracking

### Phase Status
- [ ] Phase 1: Database Layer
- [ ] Phase 2: Backend Layer
- [ ] Phase 3: Frontend Layer
- [ ] Phase 4: Testing
- [ ] Phase 5: Documentation
- [ ] Phase 6: Deployment
- [ ] Phase 7: Monitoring & Iteration

### Blockers
- None currently.

### Notes
- This plan prioritizes visual signal clarity over heavy redesign.
- Keep implementation incremental and testable (backend contracts first, then UI).
- If a dedicated `/sync` page remains deprecated, temporal freshness should be surfaced directly on dashboard cards.
