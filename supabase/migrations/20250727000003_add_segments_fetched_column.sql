-- Migration: 20250727000003_add_segments_fetched_column.sql
-- Description: Add segments_fetched column to activities table

-- Add segments_fetched column to activities table
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS segments_fetched BOOLEAN DEFAULT FALSE;

-- Create index for better performance when querying activities needing segments
CREATE INDEX IF NOT EXISTS idx_activities_segments_fetched ON activities(segments_fetched);

-- Update existing activities to have segments_fetched = false
UPDATE activities 
SET segments_fetched = FALSE 
WHERE segments_fetched IS NULL; 