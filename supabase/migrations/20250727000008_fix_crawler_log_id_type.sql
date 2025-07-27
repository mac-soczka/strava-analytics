-- Fix the crawler function to handle UUID log_id correctly
-- The issue was that log_id is UUID but we were treating it as integer

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
  error_details text;
  log_id uuid; -- Changed from int to uuid
BEGIN
  start_time := now();
  
  -- Log the start with detailed initialization
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
    'Crawler started - initializing database operations',
    0,
    0,
    0
  ) RETURNING id INTO log_id;
  
  -- Step 1: Get user count with error handling
  BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    IF user_count IS NULL OR user_count < 0 THEN
      user_count := 0;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_count := 0;
      error_details := 'Failed to count users: ' || SQLERRM;
      RAISE NOTICE 'Warning: %', error_details;
  END;
  
  -- Step 2: Count activities that need segments with error handling
  BEGIN
    SELECT COUNT(*) INTO activity_count 
    FROM activities 
    WHERE segments_fetched = false;
    IF activity_count IS NULL OR activity_count < 0 THEN
      activity_count := 0;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      activity_count := 0;
      error_details := COALESCE(error_details, '') || '; Failed to count activities needing segments: ' || SQLERRM;
      RAISE NOTICE 'Warning: %', error_details;
  END;
  
  -- Step 3: Count total segments with error handling
  BEGIN
    SELECT COUNT(*) INTO segment_count FROM segments;
    IF segment_count IS NULL OR segment_count < 0 THEN
      segment_count := 0;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      segment_count := 0;
      error_details := COALESCE(error_details, '') || '; Failed to count segments: ' || SQLERRM;
      RAISE NOTICE 'Warning: %', error_details;
  END;
  
  end_time := now();
  
  -- Determine status based on errors encountered
  DECLARE
    final_status text;
    final_message text;
  BEGIN
    IF error_details IS NOT NULL AND error_details != '' THEN
      final_status := 'error';
      final_message := 'Crawler completed with errors: ' || user_count || ' users, ' || activity_count || ' activities need segments, ' || segment_count || ' total segments. Errors: ' || error_details;
    ELSE
      final_status := 'success';
      final_message := 'Crawler completed successfully: ' || user_count || ' users, ' || activity_count || ' activities need segments, ' || segment_count || ' total segments';
    END IF;
    
    -- Update the log with final results
    UPDATE strava_crawler_logs 
    SET 
      status = final_status,
      message = final_message,
      activities_fetched = activity_count,
      segments_fetched = segment_count,
      execution_time_ms = EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
      error = CASE WHEN error_details IS NOT NULL AND error_details != '' THEN error_details ELSE NULL END
    WHERE id = log_id;
    
    result := jsonb_build_object(
      'success', final_status = 'success',
      'message', final_message,
      'users_processed', user_count,
      'activities_needing_segments', activity_count,
      'total_segments', segment_count,
      'execution_time_ms', EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
      'errors', CASE WHEN error_details IS NOT NULL AND error_details != '' THEN error_details ELSE NULL END,
      'timestamp', now()
    );
  END;
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    end_time := now();
    error_details := 'Critical crawler failure: ' || SQLERRM;
    
    -- Try to update the existing log entry with error
    BEGIN
      UPDATE strava_crawler_logs 
      SET 
        status = 'error',
        message = error_details,
        execution_time_ms = EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
        error = SQLERRM
      WHERE id = log_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- If we can't update the existing log, create a new error log
        INSERT INTO strava_crawler_logs (
          run_at,
          status,
          message,
          activities_fetched,
          segments_fetched,
          execution_time_ms,
          error
        ) VALUES (
          end_time,
          'error',
          'Critical crawler failure - could not update existing log',
          0,
          0,
          EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
          SQLERRM
        );
    END;
    
    -- Log the critical error to console (if possible)
    RAISE LOG 'Critical crawler error: %', error_details;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', error_details,
      'execution_time_ms', EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
      'timestamp', now()
    );
END;
$$;

-- Add comprehensive comments
COMMENT ON FUNCTION trigger_strava_crawler_direct() IS 'Fixed Strava crawler trigger with UUID log_id handling and comprehensive error reporting'; 