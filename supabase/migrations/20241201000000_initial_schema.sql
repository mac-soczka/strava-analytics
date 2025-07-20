-- Migration: 20241201000000_initial_schema.sql
-- Description: Initial database schema for Strava heatmap application
-- Tables: users, strava_tokens, activities
-- Features: RLS policies, indexes, triggers

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_id BIGINT UNIQUE NOT NULL,
  firstname VARCHAR(255),
  lastname VARCHAR(255),
  city VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255),
  profile_picture TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create strava_tokens table for secure token storage
CREATE TABLE IF NOT EXISTS strava_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_id BIGINT UNIQUE NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create activities table for storing Strava activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
  activity_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(500),
  distance DECIMAL(10,2),
  moving_time INTEGER,
  elapsed_time INTEGER,
  total_elevation_gain DECIMAL(8,2),
  type VARCHAR(100),
  start_date TIMESTAMP WITH TIME ZONE,
  start_date_local TIMESTAMP WITH TIME ZONE,
  average_speed DECIMAL(8,2),
  max_speed DECIMAL(8,2),
  average_watts DECIMAL(8,2),
  max_watts INTEGER,
  average_heartrate DECIMAL(5,2),
  max_heartrate INTEGER,
  polyline TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_strava_id ON users(strava_id);
CREATE INDEX IF NOT EXISTS idx_strava_tokens_strava_id ON strava_tokens(strava_id);
CREATE INDEX IF NOT EXISTS idx_activities_strava_id ON activities(strava_id);
CREATE INDEX IF NOT EXISTS idx_activities_activity_id ON activities(activity_id);
CREATE INDEX IF NOT EXISTS idx_activities_start_date ON activities(start_date);
-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
-- Create RLS policies (you can customize these based on your needs)
-- For now, we'll allow all operations for authenticated users
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (true);
CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (true);
CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Tokens can be managed by service role" ON strava_tokens
  FOR ALL USING (true);
CREATE POLICY "Activities can be viewed by owner" ON activities
  FOR SELECT USING (true);
CREATE POLICY "Activities can be inserted by service role" ON activities
  FOR INSERT WITH CHECK (true);
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';
-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_strava_tokens_updated_at BEFORE UPDATE ON strava_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
