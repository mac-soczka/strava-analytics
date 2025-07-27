-- Migration: 20250729000000_add_aggregate_views.sql
-- Description: Add database views for pre-calculated aggregates to improve performance

-- View for activity statistics
CREATE OR REPLACE VIEW activity_stats AS
SELECT 
  COUNT(*) as total_activities,
  SUM(distance) as total_distance,
  SUM(moving_time) as total_time,
  SUM(total_elevation_gain) as total_elevation,
  COUNT(DISTINCT type) as activity_types_count,
  JSONB_OBJECT_AGG(type, type_count) as activity_types
FROM (
  SELECT 
    *,
    COUNT(*) OVER (PARTITION BY type) as type_count
  FROM activities
) subquery;

-- View for segment statistics
CREATE OR REPLACE VIEW segment_stats AS
SELECT 
  COUNT(*) as total_segments,
  SUM(distance) as total_distance,
  SUM(elevation_gain) as total_elevation,
  COUNT(DISTINCT city) as unique_cities,
  COUNT(DISTINCT state) as unique_states
FROM segments;

-- View for segment effort statistics
CREATE OR REPLACE VIEW segment_effort_stats AS
SELECT 
  COUNT(*) as total_efforts,
  COUNT(DISTINCT segment_id) as unique_segments_attempted,
  COUNT(DISTINCT activity_id) as activities_with_efforts
FROM segment_efforts;

-- View for user activity type distribution
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

-- Materialized view for frequently accessed aggregates (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_summary_stats AS
SELECT 
  u.strava_id,
  u.firstname,
  u.lastname,
  COALESCE(act_stats.total_activities, 0) as total_activities,
  COALESCE(act_stats.total_distance, 0) as total_distance,
  COALESCE(act_stats.total_time, 0) as total_time,
  COALESCE(act_stats.total_elevation, 0) as total_elevation,
  COALESCE(effort_stats.total_efforts, 0) as total_efforts,
  COALESCE(effort_stats.unique_segments_attempted, 0) as unique_segments_attempted,
  COALESCE(act_types.activity_types, '{}'::jsonb) as activity_types,
  COALESCE(act_stats.activity_types_count, 0) as activity_types_count
FROM users u
LEFT JOIN (
  SELECT 
    strava_id,
    COUNT(*) as total_activities,
    SUM(distance) as total_distance,
    SUM(moving_time) as total_time,
    SUM(total_elevation_gain) as total_elevation,
    COUNT(DISTINCT type) as activity_types_count
  FROM activities
  GROUP BY strava_id
) act_stats ON u.strava_id = act_stats.strava_id
LEFT JOIN (
  SELECT 
    a.strava_id,
    COUNT(*) as total_efforts,
    COUNT(DISTINCT se.segment_id) as unique_segments_attempted
  FROM segment_efforts se
  JOIN activities a ON se.activity_id = a.activity_id
  GROUP BY a.strava_id
) effort_stats ON u.strava_id = effort_stats.strava_id
LEFT JOIN user_activity_types act_types ON u.strava_id = act_types.strava_id;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activities_strava_id_type ON activities(strava_id, type);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_activity_id ON segment_efforts(activity_id);
CREATE INDEX IF NOT EXISTS idx_user_summary_stats_strava_id ON user_summary_stats(strava_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_summary_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW user_summary_stats;
END;
$$ LANGUAGE plpgsql; 