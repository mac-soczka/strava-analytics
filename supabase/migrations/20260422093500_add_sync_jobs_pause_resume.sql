-- Migration: Add pause/resume support for rate limiting
-- Created: 2026-04-22
-- Note: Depends on 20260422093422_add_paused_status_enum.sql

-- Add pause/resume fields to sync_jobs table
ALTER TABLE sync_jobs 
  ADD COLUMN IF NOT EXISTS last_processed_activity_id BIGINT,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resume_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- Step 3: Create index for finding paused jobs ready to resume  
DROP INDEX IF EXISTS idx_sync_jobs_resume;
CREATE INDEX idx_sync_jobs_resume 
  ON sync_jobs(resume_at) 
  WHERE resume_at IS NOT NULL;

-- Function to get paused jobs ready to resume
CREATE OR REPLACE FUNCTION get_paused_jobs_ready_to_resume()
RETURNS SETOF sync_jobs AS $$
  SELECT * FROM sync_jobs
  WHERE status = 'paused'
    AND resume_at IS NOT NULL
    AND resume_at <= NOW()
  ORDER BY resume_at ASC;
$$ LANGUAGE sql STABLE;

-- Function to pause a job due to rate limiting
CREATE OR REPLACE FUNCTION pause_sync_job(
  job_id UUID,
  last_activity_id BIGINT,
  reason TEXT DEFAULT 'Rate limit exceeded'
)
RETURNS sync_jobs AS $$
DECLARE
  resume_time TIMESTAMPTZ;
  result_row sync_jobs;
BEGIN
  -- Calculate resume time (15 minutes from now)
  resume_time := NOW() + INTERVAL '15 minutes';
  
  UPDATE sync_jobs
  SET 
    status = 'paused',
    last_processed_activity_id = last_activity_id,
    paused_at = NOW(),
    resume_at = resume_time,
    pause_reason = reason,
    updated_at = NOW()
  WHERE id = job_id
  RETURNING * INTO result_row;
  
  RETURN result_row;
END;
$$ LANGUAGE plpgsql;

-- Function to resume a paused job
CREATE OR REPLACE FUNCTION resume_sync_job(job_id UUID)
RETURNS sync_jobs AS $$
DECLARE
  result_row sync_jobs;
BEGIN
  UPDATE sync_jobs
  SET 
    status = 'running',
    updated_at = NOW()
  WHERE id = job_id
  RETURNING * INTO result_row;
  
  RETURN result_row;
END;
$$ LANGUAGE plpgsql;
