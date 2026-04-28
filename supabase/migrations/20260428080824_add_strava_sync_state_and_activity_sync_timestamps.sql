-- Migration: Add strava_sync_state + activity sync timestamps
-- Created: 2026-04-28

-- Per-user sync cursor/budget state for request-efficient multi-day backfill.
CREATE TABLE IF NOT EXISTS strava_sync_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_id BIGINT UNIQUE NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,

  -- Frontfill/backfill cursors
  activities_after INTEGER,          -- epoch seconds (frontfill lower bound)
  backfill_cursor_before INTEGER,    -- epoch seconds (backfill upper bound)
  last_full_backfill_at TIMESTAMPTZ,

  -- Optional controls
  daily_budget_override INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strava_sync_state_strava_id
  ON strava_sync_state(strava_id);

ALTER TABLE strava_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sync state can be viewed by owner" ON strava_sync_state;
CREATE POLICY "Sync state can be viewed by owner" ON strava_sync_state
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sync state can be managed by service role" ON strava_sync_state;
CREATE POLICY "Sync state can be managed by service role" ON strava_sync_state
  FOR ALL USING (true);

-- Activity-level sync timestamps to support TTL + "what needs syncing" queries.
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS activity_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activity_details_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS segment_efforts_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_activities_activity_details_synced_at
  ON activities(activity_details_synced_at);

CREATE INDEX IF NOT EXISTS idx_activities_segment_efforts_synced_at
  ON activities(segment_efforts_synced_at);

