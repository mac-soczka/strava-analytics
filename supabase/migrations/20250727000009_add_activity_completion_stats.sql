-- Function to get activity completion statistics
CREATE OR REPLACE FUNCTION get_activity_completion_stats()
RETURNS TABLE (
  total_activities_fetched INTEGER,
  total_activities_available INTEGER,
  activities_with_segments INTEGER,
  activities_without_segments INTEGER,
  activities_with_polyline INTEGER,
  activities_without_polyline INTEGER,
  completion_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH activity_stats AS (
    SELECT 
      COUNT(*) as total_fetched,
      COUNT(CASE WHEN segments_fetched = true THEN 1 END) as with_segments,
      COUNT(CASE WHEN segments_fetched = false OR segments_fetched IS NULL THEN 1 END) as without_segments,
      COUNT(CASE WHEN polyline IS NOT NULL AND polyline != '' THEN 1 END) as with_polyline,
      COUNT(CASE WHEN polyline IS NULL OR polyline = '' THEN 1 END) as without_polyline
    FROM activities
  )
  SELECT 
    ast.total_fetched::INTEGER,
    -- Estimate total available based on recent activity patterns
    -- This is a rough estimate - in reality, we'd need to query Strava API
    (ast.total_fetched + 
     CASE 
       WHEN ast.total_fetched > 0 THEN 
         -- Assume we might have missed some recent activities
         GREATEST(10, ast.total_fetched * 0.05)::INTEGER
       ELSE 0 
     END)::INTEGER as total_available,
    ast.with_segments::INTEGER,
    ast.without_segments::INTEGER,
    ast.with_polyline::INTEGER,
    ast.without_polyline::INTEGER,
    CASE 
      WHEN ast.total_fetched > 0 THEN 
        ROUND((ast.with_segments::NUMERIC / ast.total_fetched::NUMERIC) * 100, 1)
      ELSE 0 
    END as completion_percentage
  FROM activity_stats ast;
END;
$$ LANGUAGE plpgsql;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_activities_segments_fetched ON activities(segments_fetched);
CREATE INDEX IF NOT EXISTS idx_activities_polyline ON activities(polyline) WHERE polyline IS NOT NULL; 