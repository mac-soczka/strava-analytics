-- Migration: 20250727000002_add_segments_and_efforts.sql
-- Description: Add segments and segment_efforts tables for Strava segment data
-- This migration is idempotent and can be run multiple times safely

-- Create segments table
CREATE TABLE IF NOT EXISTS segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(500),
  distance DECIMAL(10,2),
  elevation_gain DECIMAL(8,2),
  average_grade DECIMAL(5,2),
  maximum_grade DECIMAL(5,2),
  climb_category INTEGER,
  city VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255),
  polyline TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create segment_efforts table (junction table linking activities to segments)
CREATE TABLE IF NOT EXISTS segment_efforts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  segment_id BIGINT NOT NULL,
  effort_id BIGINT UNIQUE NOT NULL,
  elapsed_time INTEGER,
  moving_time INTEGER,
  start_date TIMESTAMP WITH TIME ZONE,
  average_watts DECIMAL(8,2),
  max_watts INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Composite unique constraint to prevent duplicate efforts
  UNIQUE(activity_id, segment_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_segments_segment_id ON segments(segment_id);
CREATE INDEX IF NOT EXISTS idx_segments_city ON segments(city);
CREATE INDEX IF NOT EXISTS idx_segments_state ON segments(state);
CREATE INDEX IF NOT EXISTS idx_segments_country ON segments(country);
CREATE INDEX IF NOT EXISTS idx_segments_climb_category ON segments(climb_category);

CREATE INDEX IF NOT EXISTS idx_segment_efforts_activity_id ON segment_efforts(activity_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_segment_id ON segment_efforts(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_effort_id ON segment_efforts(effort_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_start_date ON segment_efforts(start_date);

-- Enable Row Level Security (RLS)
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_efforts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for segments (drop if exists first)
DROP POLICY IF EXISTS "Segments can be viewed by all users" ON segments;
CREATE POLICY "Segments can be viewed by all users" ON segments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Segments can be managed by service role" ON segments;
CREATE POLICY "Segments can be managed by service role" ON segments
  FOR ALL USING (true);

-- Create RLS policies for segment_efforts (drop if exists first)
DROP POLICY IF EXISTS "Segment efforts can be viewed by activity owner" ON segment_efforts;
CREATE POLICY "Segment efforts can be viewed by activity owner" ON segment_efforts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM activities 
      WHERE activities.activity_id = segment_efforts.activity_id
    )
  );

DROP POLICY IF EXISTS "Segment efforts can be managed by service role" ON segment_efforts;
CREATE POLICY "Segment efforts can be managed by service role" ON segment_efforts
  FOR ALL USING (true);

-- Add foreign key constraints (only if they don't exist)
DO $$
BEGIN
  -- Add foreign key from segment_efforts to activities
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'segment_efforts_activity_id_fkey'
  ) THEN
    ALTER TABLE segment_efforts 
    ADD CONSTRAINT segment_efforts_activity_id_fkey 
    FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key from segment_efforts to segments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'segment_efforts_segment_id_fkey'
  ) THEN
    ALTER TABLE segment_efforts 
    ADD CONSTRAINT segment_efforts_segment_id_fkey 
    FOREIGN KEY (segment_id) REFERENCES segments(segment_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at (drop if exists first)
DROP TRIGGER IF EXISTS update_segments_updated_at ON segments;
CREATE TRIGGER update_segments_updated_at
    BEFORE UPDATE ON segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_segment_efforts_updated_at ON segment_efforts;
CREATE TRIGGER update_segment_efforts_updated_at
    BEFORE UPDATE ON segment_efforts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 