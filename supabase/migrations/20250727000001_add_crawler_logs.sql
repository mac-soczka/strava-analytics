-- Create strava_crawler_logs table for tracking crawler execution
CREATE TABLE IF NOT EXISTS strava_crawler_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id BIGINT REFERENCES users(strava_id),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  message TEXT NOT NULL,
  activities_fetched INTEGER DEFAULT 0,
  segments_fetched INTEGER DEFAULT 0,
  error TEXT,
  execution_time_ms INTEGER DEFAULT 0,
  rate_limit_status JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crawler_logs_run_at ON strava_crawler_logs(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawler_logs_user_id ON strava_crawler_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_crawler_logs_status ON strava_crawler_logs(status);

-- Create RLS policies (drop if exists first)
DROP POLICY IF EXISTS "Crawler logs can be managed by service role" ON strava_crawler_logs;
CREATE POLICY "Crawler logs can be managed by service role" ON strava_crawler_logs
  FOR ALL USING (true);

-- Enable RLS
ALTER TABLE strava_crawler_logs ENABLE ROW LEVEL SECURITY; 