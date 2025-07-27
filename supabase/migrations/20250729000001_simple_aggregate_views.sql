-- Migration: 20250729000001_simple_aggregate_views.sql
-- Description: Add simple database views for pre-calculated aggregates

-- Simple view for activity type counts per user
CREATE OR REPLACE VIEW user_activity_types AS
SELECT 
  strava_id,
  JSONB_OBJECT_AGG(type, count) as activity_types
FROM (
  SELECT 
    strava_id,
    type,
    COUNT(*) as count
  FROM activities
  GROUP BY strava_id, type
) grouped
GROUP BY strava_id;

-- Simple view for user activity statistics
CREATE OR REPLACE VIEW user_activity_stats AS
SELECT 
  strava_id,
  COUNT(*) as total_activities,
  SUM(distance) as total_distance,
  SUM(moving_time) as total_time,
  SUM(total_elevation_gain) as total_elevation,
  COUNT(DISTINCT type) as activity_types_count
FROM activities
GROUP BY strava_id;

-- Simple view for user segment effort statistics
CREATE OR REPLACE VIEW user_segment_effort_stats AS
SELECT 
  a.strava_id,
  COUNT(*) as total_efforts,
  COUNT(DISTINCT se.segment_id) as unique_segments_attempted
FROM segment_efforts se
JOIN activities a ON se.activity_id = a.activity_id
GROUP BY a.strava_id;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activities_strava_id_type ON activities(strava_id, type);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_activity_id ON segment_efforts(activity_id);

-- Function to get user stats (can be called from application)
CREATE OR REPLACE FUNCTION get_user_stats(user_strava_id BIGINT)
RETURNS TABLE(
  total_activities BIGINT,
  total_distance NUMERIC,
  total_time BIGINT,
  total_elevation NUMERIC,
  total_efforts BIGINT,
  unique_segments_attempted BIGINT,
  activity_types JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(act_stats.total_activities, 0)::BIGINT,
    COALESCE(act_stats.total_distance, 0)::NUMERIC,
    COALESCE(act_stats.total_time, 0)::BIGINT,
    COALESCE(act_stats.total_elevation, 0)::NUMERIC,
    COALESCE(effort_stats.total_efforts, 0)::BIGINT,
    COALESCE(effort_stats.unique_segments_attempted, 0)::BIGINT,
    COALESCE(act_types.activity_types, '{}'::jsonb)
  FROM user_activity_stats act_stats
  FULL OUTER JOIN user_segment_effort_stats effort_stats 
    ON act_stats.strava_id = effort_stats.strava_id
  FULL OUTER JOIN user_activity_types act_types 
    ON act_stats.strava_id = act_types.strava_id
  WHERE act_stats.strava_id = user_strava_id 
     OR effort_stats.strava_id = user_strava_id 
     OR act_types.strava_id = user_strava_id;
END;
$$ LANGUAGE plpgsql; 