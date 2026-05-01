-- Migration: Add checkpoint table for segment-target sync backfill/incremental
-- Created: 2026-05-01

CREATE TABLE IF NOT EXISTS segment_target_sync_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
  segment_id BIGINT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'backfill' CHECK (mode IN ('backfill', 'incremental')),
  backfill_before_epoch INTEGER,
  incremental_after_epoch INTEGER,
  last_activity_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_segment_target_sync_state_user_segment
  ON segment_target_sync_state(strava_id, segment_id);

CREATE INDEX IF NOT EXISTS idx_segment_target_sync_state_mode
  ON segment_target_sync_state(mode);

CREATE INDEX IF NOT EXISTS idx_segment_efforts_segment_id_start_date
  ON segment_efforts(segment_id, start_date DESC);

ALTER TABLE segment_target_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Segment target sync state can be viewed by owner" ON segment_target_sync_state;
CREATE POLICY "Segment target sync state can be viewed by owner" ON segment_target_sync_state
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Segment target sync state can be managed by service role" ON segment_target_sync_state;
CREATE POLICY "Segment target sync state can be managed by service role" ON segment_target_sync_state
  FOR ALL USING (true);

