-- Create app_sessions table for authentication
CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_sessions_token ON app_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_app_sessions_strava_id ON app_sessions(strava_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop if exists first)
DROP POLICY IF EXISTS "Sessions can be managed by service role" ON app_sessions;
CREATE POLICY "Sessions can be managed by service role" ON app_sessions
  FOR ALL USING (true);

-- Create cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM app_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql; 