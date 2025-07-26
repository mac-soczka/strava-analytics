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

-- Create comprehensive dashboard statistics function
CREATE OR REPLACE FUNCTION get_dashboard_statistics()
RETURNS TABLE (
  total_activities BIGINT,
  total_segments BIGINT,
  total_efforts BIGINT,
  total_distance NUMERIC,
  total_time BIGINT,
  total_elevation NUMERIC,
  avg_speed NUMERIC,
  avg_elevation_per_activity NUMERIC,
  activity_types JSONB,
  top_segments JSONB,
  recent_activities JSONB,
  monthly_trends JSONB
) AS $$
DECLARE
  activity_types_json JSONB;
  top_segments_json JSONB;
  recent_activities_json JSONB;
  monthly_trends_json JSONB;
BEGIN
  -- Get activity type distribution
  SELECT jsonb_object_agg(type, count) INTO activity_types_json
  FROM (SELECT type, COUNT(*) as count FROM activities GROUP BY type) t;
  
  -- Get top segments by effort count
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.segment_id,
      'name', s.name,
      'distance', s.distance,
      'elevation', s.elevation_gain,
      'effort_count', COALESCE(e.effort_count, 0)
    )
  ) INTO top_segments_json
  FROM segments s
  LEFT JOIN (
    SELECT segment_id, COUNT(*) as effort_count
    FROM segment_efforts
    GROUP BY segment_id
  ) e ON s.segment_id = e.segment_id
  WHERE e.effort_count > 0
  ORDER BY e.effort_count DESC
  LIMIT 10;
  
  -- Get recent activities
  SELECT jsonb_agg(
    jsonb_build_object(
      'activity_id', activity_id,
      'name', name,
      'distance', distance,
      'moving_time', moving_time,
      'total_elevation_gain', total_elevation_gain,
      'type', type,
      'start_date', start_date
    )
  ) INTO recent_activities_json
  FROM activities
  ORDER BY start_date DESC
  LIMIT 5;
  
  -- Get monthly trends (last 12 months)
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', month_name,
      'activities', activity_count,
      'distance', total_distance,
      'elevation', total_elevation
    )
  ) INTO monthly_trends_json
  FROM (
    SELECT 
      to_char(date_trunc('month', start_date), 'Mon') as month_name,
      COUNT(*) as activity_count,
      COALESCE(SUM(distance), 0) as total_distance,
      COALESCE(SUM(total_elevation_gain), 0) as total_elevation
    FROM activities
    WHERE start_date >= date_trunc('month', CURRENT_DATE - INTERVAL '11 months')
    GROUP BY date_trunc('month', start_date)
    ORDER BY date_trunc('month', start_date)
  ) monthly_data;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM activities) as total_activities,
    (SELECT COUNT(*) FROM segments) as total_segments,
    (SELECT COUNT(*) FROM segment_efforts) as total_efforts,
    (SELECT COALESCE(SUM(distance), 0) FROM activities) as total_distance,
    (SELECT COALESCE(SUM(moving_time), 0) FROM activities) as total_time,
    (SELECT COALESCE(SUM(total_elevation_gain), 0) FROM activities) as total_elevation,
    CASE 
      WHEN (SELECT COALESCE(SUM(moving_time), 0) FROM activities) > 0 
      THEN ((SELECT COALESCE(SUM(distance), 0) FROM activities) / 1000.0) / 
           ((SELECT COALESCE(SUM(moving_time), 0) FROM activities) / 3600.0)
      ELSE 0 
    END as avg_speed,
    CASE 
      WHEN (SELECT COUNT(*) FROM activities) > 0 
      THEN (SELECT COALESCE(SUM(total_elevation_gain), 0) FROM activities) / 
           (SELECT COUNT(*) FROM activities)
      ELSE 0 
    END as avg_elevation_per_activity,
    COALESCE(activity_types_json, '{}'::jsonb) as activity_types,
    COALESCE(top_segments_json, '[]'::jsonb) as top_segments,
    COALESCE(recent_activities_json, '[]'::jsonb) as recent_activities,
    COALESCE(monthly_trends_json, '[]'::jsonb) as monthly_trends;
END;
$$ LANGUAGE plpgsql; 