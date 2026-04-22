-- Migration: Add sync jobs table for tracking background sync operations
-- Created: 2026-04-22

-- Create enum types
CREATE TYPE sync_job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE sync_job_type AS ENUM ('full_sync', 'activities_only', 'routes_only', 'stats_only');

-- Create sync_jobs table
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
  
  -- Job metadata
  type sync_job_type NOT NULL DEFAULT 'full_sync',
  status sync_job_status NOT NULL DEFAULT 'pending',
  
  -- Progress tracking
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  
  -- Detailed progress by entity type
  progress JSONB DEFAULT '{
    "activities": {"total": 0, "processed": 0, "failed": 0},
    "laps": {"total": 0, "processed": 0, "failed": 0},
    "streams": {"total": 0, "processed": 0, "failed": 0},
    "segments": {"total": 0, "processed": 0, "failed": 0},
    "routes": {"total": 0, "processed": 0, "failed": 0},
    "stats": {"total": 0, "processed": 0, "failed": 0}
  }'::jsonb,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  
  -- Metadata
  triggered_by TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sync_jobs_strava_id ON sync_jobs(strava_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at DESC);
CREATE INDEX idx_sync_jobs_strava_status ON sync_jobs(strava_id, status);

-- RLS policies
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync jobs"
  ON sync_jobs FOR SELECT
  USING (strava_id = (SELECT strava_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create their own sync jobs"
  ON sync_jobs FOR INSERT
  WITH CHECK (strava_id = (SELECT strava_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Sync jobs can be managed by service role"
  ON sync_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Updated at trigger
CREATE TRIGGER update_sync_jobs_updated_at
  BEFORE UPDATE ON sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get active sync job for user
CREATE OR REPLACE FUNCTION get_active_sync_job(user_strava_id BIGINT)
RETURNS sync_jobs AS $$
  SELECT * FROM sync_jobs
  WHERE strava_id = user_strava_id
    AND status IN ('pending', 'running')
  ORDER BY created_at DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Function to cancel stale jobs (running for > 2 hours)
CREATE OR REPLACE FUNCTION cancel_stale_sync_jobs()
RETURNS INTEGER AS $$
DECLARE
  cancelled_count INTEGER;
BEGIN
  UPDATE sync_jobs
  SET 
    status = 'failed',
    error_message = 'Job timed out after 2 hours',
    completed_at = NOW()
  WHERE 
    status = 'running'
    AND started_at < NOW() - INTERVAL '2 hours'
  RETURNING COUNT(*) INTO cancelled_count;
  
  RETURN cancelled_count;
END;
$$ LANGUAGE plpgsql;
