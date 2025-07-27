-- Migration: 20250728000000_add_strava_url_to_activities.sql
-- Description: Add strava_url field to activities table for direct links to Strava

-- Add the strava_url column
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS strava_url TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN activities.strava_url IS 'Direct URL to the activity on Strava';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_activities_strava_url 
ON activities(strava_url);

-- Update existing activities to have a default Strava URL
UPDATE activities 
SET strava_url = 'https://www.strava.com/activities/' || activity_id::text
WHERE strava_url IS NULL; 