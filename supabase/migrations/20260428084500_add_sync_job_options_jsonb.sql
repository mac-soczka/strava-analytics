-- Migration: Add sync_jobs.options JSONB for job mode/params
-- Created: 2026-04-28

ALTER TABLE sync_jobs
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sync_jobs_options_gin
  ON sync_jobs
  USING GIN (options);

