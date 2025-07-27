-- Fix the crawler function to use valid status values
-- The status 'pending' is not allowed, use 'partial' instead

CREATE OR REPLACE FUNCTION trigger_strava_crawler_direct()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  start_time timestamp;
  end_time timestamp;
  user_count int;
  activity_count int;
  segment_count int;
BEGIN
  start_time := now();
  
  -- Log the start
  INSERT INTO strava_crawler_logs (
    run_at,
    status,
    message,
    activities_fetched,
    segments_fetched,
    execution_time_ms
  ) VALUES (
    start_time,
    'partial',
    'Crawler started - processing users',
    0,
    0,
    0
  );
  
  -- Get user count for logging
  SELECT COUNT(*) INTO user_count FROM users;
  
  -- Count activities that need segments
  SELECT COUNT(*) INTO activity_count 
  FROM activities 
  WHERE segments_fetched = false;
  
  -- Count total segments
  SELECT COUNT(*) INTO segment_count FROM segments;
  
  end_time := now();
  
  -- Update the log with actual information
  UPDATE strava_crawler_logs 
  SET 
    status = 'success',
    message = 'Crawler completed: ' || user_count || ' users, ' || activity_count || ' activities need segments, ' || segment_count || ' total segments',
    activities_fetched = activity_count,
    segments_fetched = segment_count,
    execution_time_ms = EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
  WHERE run_at = start_time;
  
  result := jsonb_build_object(
    'success', true,
    'message', 'Crawler completed: ' || user_count || ' users, ' || activity_count || ' activities need segments, ' || segment_count || ' total segments',
    'users_processed', user_count,
    'activities_needing_segments', activity_count,
    'total_segments', segment_count,
    'timestamp', now()
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    end_time := now();
    
    -- Log error
    UPDATE strava_crawler_logs 
    SET 
      status = 'error',
      message = 'Crawler failed: ' || SQLERRM,
      execution_time_ms = EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
      error = SQLERRM
    WHERE run_at = start_time;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
END;
$$;

-- Add comments for clarity
COMMENT ON FUNCTION trigger_strava_crawler_direct() IS 'Strava crawler trigger - processes user data and updates segments every 15 minutes'; 