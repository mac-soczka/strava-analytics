-- Migration: 20250720180000_add_segment_statistics_functions.sql
-- Description: Add database functions for efficient segment statistics calculation

-- Create function to get segment statistics (most efficient)
CREATE OR REPLACE FUNCTION get_segment_statistics()
RETURNS TABLE (
  total_segments BIGINT,
  total_efforts BIGINT,
  total_distance NUMERIC,
  total_elevation NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM segments) as total_segments,
    (SELECT COUNT(*) FROM segment_efforts) as total_efforts,
    (SELECT COALESCE(SUM(distance), 0) FROM segments) as total_distance,
    (SELECT COALESCE(SUM(elevation_gain), 0) FROM segments) as total_elevation;
END;
$$ LANGUAGE plpgsql;

-- Create function to get segments with effort counts
CREATE OR REPLACE FUNCTION get_segments_with_effort_counts(limit_count INTEGER DEFAULT 200)
RETURNS TABLE (
  segment_id BIGINT,
  name TEXT,
  distance NUMERIC,
  elevation_gain NUMERIC,
  elevation_low NUMERIC,
  average_grade NUMERIC,
  maximum_grade NUMERIC,
  climb_category INTEGER,
  city TEXT,
  state TEXT,
  country TEXT,
  polyline TEXT,
  effort_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.segment_id,
    s.name,
    s.distance,
    s.elevation_gain,
    s.elevation_low,
    s.average_grade,
    s.maximum_grade,
    s.climb_category,
    s.city,
    s.state,
    s.country,
    s.polyline,
    COALESCE(e.effort_count, 0) as effort_count
  FROM segments s
  LEFT JOIN (
    SELECT segment_id, COUNT(*) as effort_count
    FROM segment_efforts
    GROUP BY segment_id
  ) e ON s.segment_id = e.segment_id
  ORDER BY s.name
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for activity statistics
CREATE OR REPLACE FUNCTION get_activity_statistics()
RETURNS TABLE (
  total_activities BIGINT,
  total_distance NUMERIC,
  total_time BIGINT,
  total_elevation NUMERIC,
  by_sport_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM activities) as total_activities,
    (SELECT COALESCE(SUM(distance), 0) FROM activities) as total_distance,
    (SELECT COALESCE(SUM(moving_time), 0) FROM activities) as total_time,
    (SELECT COALESCE(SUM(total_elevation_gain), 0) FROM activities) as total_elevation,
    (SELECT jsonb_object_agg(type, count) 
     FROM (SELECT type, COUNT(*) as count FROM activities GROUP BY type) t) as by_sport_type;
END;
$$ LANGUAGE plpgsql;

-- Create function for segment effort statistics by segment
CREATE OR REPLACE FUNCTION get_segment_effort_stats()
RETURNS TABLE (
  segment_id BIGINT,
  segment_name TEXT,
  effort_count BIGINT,
  avg_time NUMERIC,
  min_time NUMERIC,
  max_time NUMERIC,
  total_distance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.segment_id,
    s.name as segment_name,
    COUNT(se.id) as effort_count,
    AVG(se.elapsed_time) as avg_time,
    MIN(se.elapsed_time) as min_time,
    MAX(se.elapsed_time) as max_time,
    s.distance as total_distance
  FROM segments s
  LEFT JOIN segment_efforts se ON s.segment_id = se.segment_id
  GROUP BY s.segment_id, s.name, s.distance
  ORDER BY effort_count DESC;
END;
$$ LANGUAGE plpgsql; 