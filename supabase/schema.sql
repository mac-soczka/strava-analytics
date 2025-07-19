-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security (RLS)
-- We'll configure this later based on your needs

-- Activities table (based on Strava API structure)
CREATE TABLE activities (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255),
  distance DECIMAL,
  moving_time INTEGER,
  elapsed_time INTEGER,
  total_elevation_gain DECIMAL,
  type VARCHAR(50),
  sport_type VARCHAR(50),
  workout_type INTEGER,
  start_date TIMESTAMP WITH TIME ZONE,
  start_date_local TIMESTAMP WITH TIME ZONE,
  timezone VARCHAR(100),
  utc_offset INTEGER,
  segments_fetched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segments table (based on Strava segment efforts)
CREATE TABLE segments (
  id SERIAL PRIMARY KEY,
  activity_id BIGINT REFERENCES activities(id) ON DELETE CASCADE,
  segment_id BIGINT,
  segment_name VARCHAR(255),
  segment_distance DECIMAL,
  segment_elevation_high DECIMAL,
  segment_elevation_low DECIMAL,
  segment_grade DECIMAL,
  segment_climb_category INTEGER,
  segment_city VARCHAR(255),
  segment_state VARCHAR(255),
  segment_country VARCHAR(255),
  segment_private BOOLEAN,
  segment_hazardous BOOLEAN,
  segment_starred BOOLEAN,
  -- Segment effort data
  elapsed_time INTEGER,
  moving_time INTEGER,
  start_date TIMESTAMP WITH TIME ZONE,
  start_date_local TIMESTAMP WITH TIME ZONE,
  average_watts DECIMAL,
  max_watts INTEGER,
  average_heartrate DECIMAL,
  max_heartrate INTEGER,
  average_cadence DECIMAL,
  max_cadence INTEGER,
  average_temp DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tokens table for Strava authentication
CREATE TABLE tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jobs table for tracking background tasks
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'fetch_segments', 'refresh_tokens', 'sync_activities'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  progress INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_activities_start_date ON activities(start_date);
CREATE INDEX idx_activities_segments_fetched ON activities(segments_fetched);
CREATE INDEX idx_segments_activity_id ON segments(activity_id);
CREATE INDEX idx_segments_segment_id ON segments(segment_id);
CREATE INDEX idx_segments_start_date ON segments(start_date);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for activities table
CREATE TRIGGER update_activities_updated_at 
    BEFORE UPDATE ON activities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial token if you have one
-- You can run this manually after setting up your tokens
-- INSERT INTO tokens (access_token, refresh_token, expires_at) 
-- VALUES ('your_access_token', 'your_refresh_token', '2025-01-01T00:00:00Z'); 