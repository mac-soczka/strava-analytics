-- Migration: 20250721000000_add_app_sessions.sql
-- Description: Add app_sessions table for application-level session management

-- Create app_sessions table
CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_sessions_token ON app_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_app_sessions_strava_id ON app_sessions(strava_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Sessions can be managed by service role" ON app_sessions
  FOR ALL USING (true);

-- Add function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM app_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired sessions (runs every hour)
-- Note: This requires pg_cron extension which may not be available in all Supabase plans
-- SELECT cron.schedule('cleanup-expired-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions();'); 