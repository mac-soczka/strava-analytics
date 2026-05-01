-- Migration: Add explicit sync phases/checkpoints and active state view
-- Created: 2026-05-01

-- Explicit phase state machine for precise resume/status visibility.
ALTER TABLE sync_jobs
  ADD COLUMN IF NOT EXISTS current_phase TEXT NOT NULL DEFAULT 'discover_activities',
  ADD COLUMN IF NOT EXISTS last_processed_segment_id BIGINT,
  ADD COLUMN IF NOT EXISTS strava_page INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cursor_after_epoch INTEGER,
  ADD COLUMN IF NOT EXISTS cursor_before_epoch INTEGER,
  ADD COLUMN IF NOT EXISTS requests_used_15m INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requests_used_daily INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_limit_15m_reset_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rate_limit_daily_reset_at TIMESTAMPTZ;

ALTER TABLE sync_jobs
  ALTER COLUMN progress SET DEFAULT '{
    "activities": {"total": 0, "processed": 0, "failed": 0},
    "segment_efforts": {"total": 0, "processed": 0, "failed": 0},
    "laps": {"total": 0, "processed": 0, "failed": 0},
    "streams": {"total": 0, "processed": 0, "failed": 0},
    "segments": {"total": 0, "processed": 0, "failed": 0},
    "routes": {"total": 0, "processed": 0, "failed": 0},
    "stats": {"total": 0, "processed": 0, "failed": 0}
  }'::jsonb;

UPDATE sync_jobs
SET progress = jsonb_set(
  COALESCE(progress, '{}'::jsonb),
  '{segment_efforts}',
  COALESCE(progress->'segment_efforts', '{"total":0,"processed":0,"failed":0}'::jsonb),
  true
);

-- Ensure we cannot run multiple active jobs for one athlete.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_jobs_one_active_per_strava
  ON sync_jobs(strava_id)
  WHERE status IN ('pending', 'running', 'paused');

-- Canonical "exact current sync state" projection for APIs/UI.
CREATE OR REPLACE VIEW active_sync_job_state AS
SELECT
  sj.id AS job_id,
  sj.strava_id,
  sj.status,
  sj.type,
  sj.current_phase,
  sj.total_items,
  sj.processed_items,
  sj.failed_items,
  sj.last_processed_activity_id,
  sj.last_processed_segment_id,
  sj.strava_page,
  sj.cursor_after_epoch,
  sj.cursor_before_epoch,
  sj.requests_used_15m,
  sj.requests_used_daily,
  sj.rate_limit_15m_reset_at,
  sj.rate_limit_daily_reset_at,
  sj.pause_reason,
  sj.paused_at,
  sj.resume_at,
  sj.error_message,
  sj.progress,
  sj.created_at,
  sj.updated_at,
  sss.activities_after,
  sss.backfill_cursor_before,
  sss.last_full_backfill_at,
  sss.daily_budget_override
FROM sync_jobs sj
LEFT JOIN strava_sync_state sss
  ON sss.strava_id = sj.strava_id
WHERE sj.status IN ('pending', 'running', 'paused')
ORDER BY sj.updated_at DESC;
