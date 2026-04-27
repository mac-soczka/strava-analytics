-- Migration: Add explicit segment fetch status for activities
-- Created: 2026-04-27

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS segments_fetch_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS segments_fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS segments_fetch_error TEXT,
  ADD COLUMN IF NOT EXISTS segments_effort_rows_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_activities_segments_fetch_status
  ON activities(segments_fetch_status);

-- Backfill status based on existing data (best-effort).
-- If segments_fetched=true and we have at least 1 effort row -> success_rows.
UPDATE activities a
SET segments_fetch_status = 'success_rows',
    segments_fetched_at = COALESCE(segments_fetched_at, NOW())
WHERE a.segments_fetched = TRUE
  AND EXISTS (
    SELECT 1 FROM segment_efforts se
    WHERE se.activity_id = a.activity_id
  )
  AND a.segments_fetch_status = 'pending';

-- If segments_fetched=true and there are 0 effort rows -> success_empty (we did fetch and got none).
UPDATE activities a
SET segments_fetch_status = 'success_empty',
    segments_fetched_at = COALESCE(segments_fetched_at, NOW())
WHERE a.segments_fetched = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM segment_efforts se
    WHERE se.activity_id = a.activity_id
  )
  AND a.segments_fetch_status = 'pending';

