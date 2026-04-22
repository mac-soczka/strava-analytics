-- Migration: 20250720190000_add_segment_efforts_fetched.sql
-- Description: Add segment_efforts_fetched column to strava_crawler_logs table

-- Add the new column
ALTER TABLE strava_crawler_logs 
ADD COLUMN IF NOT EXISTS segment_efforts_fetched INTEGER DEFAULT 0;

-- Update existing records to have 0 for the new column
UPDATE strava_crawler_logs 
SET segment_efforts_fetched = 0 
WHERE segment_efforts_fetched IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN strava_crawler_logs.segment_efforts_fetched IS 'Number of segment efforts fetched during this crawler run';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_crawler_logs_segment_efforts_fetched 
ON strava_crawler_logs(segment_efforts_fetched); 