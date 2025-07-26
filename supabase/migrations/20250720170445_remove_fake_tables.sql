-- Remove fake tables
DROP TABLE IF EXISTS fake_table;

-- Create function to get segment statistics
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
