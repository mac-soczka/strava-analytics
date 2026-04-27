-- Migration: Add sync job event logs (rate limits, progress)
-- Created: 2026-04-27

CREATE TABLE IF NOT EXISTS sync_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES sync_jobs(id) ON DELETE CASCADE,
  strava_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  message TEXT,
  stats JSONB,
  rate_limit JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_job_events_job_id_created_at
  ON sync_job_events(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_job_events_strava_id_created_at
  ON sync_job_events(strava_id, created_at DESC);

ALTER TABLE sync_job_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sync job events can be managed by service role" ON sync_job_events;
CREATE POLICY "Sync job events can be managed by service role"
  ON sync_job_events FOR ALL
  USING (auth.role() = 'service_role');

