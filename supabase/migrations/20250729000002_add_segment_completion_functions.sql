-- Migration: 20250729000002_add_segment_completion_functions.sql
-- Description: Add functions to analyze segment and segment effort completion status

-- Function to get segments without efforts
CREATE OR REPLACE FUNCTION get_segments_without_efforts(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  segment_id BIGINT,
  name TEXT,
  distance NUMERIC,
  city TEXT,
  state TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.segment_id,
    s.name,
    s.distance,
    s.city,
    s.state
  FROM segments s
  WHERE NOT EXISTS (
    SELECT 1 FROM segment_efforts se 
    WHERE se.segment_id = s.segment_id
  )
  ORDER BY s.segment_id
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get segment completion statistics
CREATE OR REPLACE FUNCTION get_segment_completion_stats()
RETURNS TABLE(
  total_activities INTEGER,
  activities_with_segments INTEGER,
  activities_without_segments INTEGER,
  segment_completion_rate NUMERIC,
  total_segments INTEGER,
  segments_with_efforts INTEGER,
  segments_without_efforts INTEGER,
  effort_completion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH activity_stats AS (
    SELECT 
      COUNT(*) as total_activities,
      COUNT(*) FILTER (WHERE segments_fetched = true) as activities_with_segments,
      COUNT(*) FILTER (WHERE segments_fetched = false) as activities_without_segments
    FROM activities
    WHERE segments_fetched IS NOT NULL
  ),
  segment_stats AS (
    SELECT 
      COUNT(DISTINCT s.segment_id) as total_segments,
      COUNT(DISTINCT se.segment_id) as segments_with_efforts
    FROM segments s
    LEFT JOIN segment_efforts se ON s.segment_id = se.segment_id
  )
  SELECT 
    ast.total_activities::INTEGER,
    ast.activities_with_segments::INTEGER,
    ast.activities_without_segments::INTEGER,
    CASE 
      WHEN ast.total_activities > 0 
      THEN ROUND((ast.activities_with_segments::NUMERIC / ast.total_activities) * 100, 2)
      ELSE 0 
    END as segment_completion_rate,
    sst.total_segments::INTEGER,
    sst.segments_with_efforts::INTEGER,
    (sst.total_segments - sst.segments_with_efforts)::INTEGER as segments_without_efforts,
    CASE 
      WHEN sst.total_segments > 0 
      THEN ROUND((sst.segments_with_efforts::NUMERIC / sst.total_segments) * 100, 2)
      ELSE 0 
    END as effort_completion_rate
  FROM activity_stats ast
  CROSS JOIN segment_stats sst;
END;
$$ LANGUAGE plpgsql;

-- Function to get user-specific segment completion stats
CREATE OR REPLACE FUNCTION get_user_segment_completion_stats(user_strava_id BIGINT)
RETURNS TABLE(
  user_name TEXT,
  total_activities INTEGER,
  activities_with_segments INTEGER,
  activities_without_segments INTEGER,
  segment_completion_rate NUMERIC,
  unique_segments_attempted INTEGER,
  segments_with_efforts INTEGER,
  effort_completion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_activities AS (
    SELECT 
      COUNT(*) as total_activities,
      COUNT(*) FILTER (WHERE segments_fetched = true) as activities_with_segments,
      COUNT(*) FILTER (WHERE segments_fetched = false) as activities_without_segments
    FROM activities
    WHERE strava_id = user_strava_id AND segments_fetched IS NOT NULL
  ),
  user_segments AS (
    SELECT 
      COUNT(DISTINCT se.segment_id) as unique_segments_attempted,
      COUNT(DISTINCT se.segment_id) FILTER (WHERE EXISTS (
        SELECT 1 FROM segment_efforts se2 
        WHERE se2.segment_id = se.segment_id
      )) as segments_with_efforts
    FROM segment_efforts se
    JOIN activities a ON se.activity_id = a.activity_id
    WHERE a.strava_id = user_strava_id
  ),
  user_info AS (
    SELECT 
      CONCAT(firstname, ' ', lastname) as user_name
    FROM users
    WHERE strava_id = user_strava_id
  )
  SELECT 
    ui.user_name,
    ua.total_activities::INTEGER,
    ua.activities_with_segments::INTEGER,
    ua.activities_without_segments::INTEGER,
    CASE 
      WHEN ua.total_activities > 0 
      THEN ROUND((ua.activities_with_segments::NUMERIC / ua.total_activities) * 100, 2)
      ELSE 0 
    END as segment_completion_rate,
    us.unique_segments_attempted::INTEGER,
    us.segments_with_efforts::INTEGER,
    CASE 
      WHEN us.unique_segments_attempted > 0 
      THEN ROUND((us.segments_with_efforts::NUMERIC / us.unique_segments_attempted) * 100, 2)
      ELSE 0 
    END as effort_completion_rate
  FROM user_activities ua
  CROSS JOIN user_segments us
  CROSS JOIN user_info ui;
END;
$$ LANGUAGE plpgsql;

-- Function to get incomplete activities for a user
CREATE OR REPLACE FUNCTION get_incomplete_activities(user_strava_id BIGINT, limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  activity_id BIGINT,
  name TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  segments_fetched BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.activity_id,
    a.name,
    a.start_date,
    a.segments_fetched
  FROM activities a
  WHERE a.strava_id = user_strava_id 
    AND a.segments_fetched = false
  ORDER BY a.start_date DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql; 