-- Migration: Add segment_efforts_fetched column to strava_crawler_logs
-- Created: 2026-05-01
--
-- This replaces an old skipped backup migration file
-- (20250720190000_add_segment_efforts_fetched.sql.bak).

ALTER TABLE strava_crawler_logs
  ADD COLUMN IF NOT EXISTS segment_efforts_fetched INTEGER DEFAULT 0;

UPDATE strava_crawler_logs
SET segment_efforts_fetched = 0
WHERE segment_efforts_fetched IS NULL;

COMMENT ON COLUMN strava_crawler_logs.segment_efforts_fetched
  IS 'Number of segment efforts fetched during this crawler run';

CREATE INDEX IF NOT EXISTS idx_crawler_logs_segment_efforts_fetched
  ON strava_crawler_logs(segment_efforts_fetched);
