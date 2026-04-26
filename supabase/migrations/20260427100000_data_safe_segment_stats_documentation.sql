-- Data-safe migration: updates only the get_user_segment_completion_stats() function.
--
-- Does NOT: TRUNCATE, DROP TABLE, DELETE FROM, or remove columns from application tables.
-- Your activities, segments, segment_efforts, users, sync_jobs, etc. stay as-is.
--
-- Apply without wiping local data:
--   supabase db push
--
-- Avoid for preserving rows:
--   supabase db reset

DROP FUNCTION IF EXISTS public.get_user_segment_completion_stats(BIGINT);

CREATE FUNCTION public.get_user_segment_completion_stats(user_strava_id BIGINT)
RETURNS TABLE(
  user_name TEXT,
  total_activities INTEGER,
  activities_with_segments INTEGER,
  activities_without_segments INTEGER,
  segment_completion_rate NUMERIC,
  unique_segments_attempted INTEGER,
  segments_with_efforts INTEGER,
  effort_completion_rate NUMERIC,
  activities_with_segment_efforts INTEGER,
  total_segment_effort_rows INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH user_activities AS (
    SELECT 
      COUNT(*) as total_activities,
      COUNT(*) FILTER (WHERE segments_fetched = true) as activities_with_segments,
      COUNT(*) FILTER (WHERE segments_fetched IS DISTINCT FROM true) as activities_without_segments
    FROM activities
    WHERE strava_id = user_strava_id
  ),
  user_segments AS (
    SELECT 
      COUNT(DISTINCT se.segment_id) as unique_segments_attempted,
      COUNT(DISTINCT se.segment_id) as segments_with_efforts
    FROM segment_efforts se
    JOIN activities a ON se.activity_id = a.activity_id
    WHERE a.strava_id = user_strava_id
  ),
  effort_activities AS (
    SELECT 
      COUNT(DISTINCT se.activity_id) as activities_with_segment_efforts,
      COUNT(*)::INTEGER as total_segment_effort_rows
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
      WHEN ua.total_activities > 0 
      THEN ROUND((ea.activities_with_segment_efforts::NUMERIC / ua.total_activities) * 100, 2)
      ELSE 0 
    END as effort_completion_rate,
    ea.activities_with_segment_efforts::INTEGER,
    ea.total_segment_effort_rows
  FROM user_activities ua
  CROSS JOIN user_segments us
  CROSS JOIN effort_activities ea
  CROSS JOIN user_info ui;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_user_segment_completion_stats(BIGINT) IS
  'Read-only sync coverage stats for one strava_id. Does not modify application tables.';
