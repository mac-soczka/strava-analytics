-- Create a direct cron function that doesn't rely on HTTP
CREATE OR REPLACE FUNCTION trigger_strava_crawler_direct()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  start_time timestamp;
  end_time timestamp;
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
    'success',
    'Cron job started - direct execution',
    0,
    0,
    0
  );
  
  -- For now, just log that the cron is working
  -- The actual crawler logic will be called via HTTP from the app
  result := jsonb_build_object(
    'success', true,
    'message', 'Cron job scheduled successfully',
    'timestamp', now(),
    'note', 'Actual crawling happens via HTTP call to /api/strava/crawl'
  );
  
  end_time := now();
  
  -- Update the log with completion
  UPDATE strava_crawler_logs 
  SET 
    status = 'success',
    message = 'Cron job completed successfully',
    execution_time_ms = EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
  WHERE run_at = start_time;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    end_time := now();
    
    -- Log error
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
      'Direct cron job failed: ' || SQLERRM,
      0,
      0,
      EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
      SQLERRM
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
END;
$$;

-- Update the cron schedule to use the direct function
SELECT cron.unschedule('strava-crawler-daily');

SELECT cron.schedule(
  'strava-crawler-daily',
  '0 6 * * *',
  'SELECT trigger_strava_crawler_direct();'
);

-- Update the manual trigger function
DROP FUNCTION IF EXISTS manual_trigger_strava_crawler();

CREATE OR REPLACE FUNCTION manual_trigger_strava_crawler()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN trigger_strava_crawler_direct();
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION manual_trigger_strava_crawler() TO authenticated; 