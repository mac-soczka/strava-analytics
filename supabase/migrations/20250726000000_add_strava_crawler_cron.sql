-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Create a function to trigger the Strava crawler
CREATE OR REPLACE FUNCTION trigger_strava_crawler()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Call the Strava crawler via HTTP
  SELECT content::json INTO result
  FROM http((
    'POST',
    'https://strava-heatmap-alpha.vercel.app/api/strava/crawl',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    '{}'
  ));
  
  -- Log the result
  INSERT INTO strava_crawler_logs (
    run_at,
    status,
    message,
    activities_fetched,
    segments_fetched,
    execution_time_ms
  ) VALUES (
    now(),
    CASE 
      WHEN result->>'success' = 'true' THEN 'success'
      ELSE 'error'
    END,
    COALESCE(result->>'message', 'Cron job executed'),
    COALESCE((result->>'total_activities')::int, 0),
    COALESCE((result->>'total_segments')::int, 0),
    COALESCE((result->>'execution_time_ms')::int, 0)
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
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
      now(),
      'error',
      'Cron job failed: ' || SQLERRM,
      0,
      0,
      0,
      SQLERRM
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
END;
$$;

-- Schedule the cron job to run daily at 6 AM UTC
-- You can modify the schedule as needed:
-- '0 6 * * *' = Daily at 6 AM
-- '0 */6 * * *' = Every 6 hours
-- '0 6,18 * * *' = Twice daily at 6 AM and 6 PM
-- '0 6 * * 1' = Weekly on Monday at 6 AM
SELECT cron.schedule(
  'strava-crawler-daily',
  '0 6 * * *',
  'SELECT trigger_strava_crawler();'
);

-- Optional: Create a function to manually trigger the crawler
CREATE OR REPLACE FUNCTION manual_trigger_strava_crawler()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN trigger_strava_crawler();
END;
$$;

-- Grant execute permissions to authenticated users (optional)
GRANT EXECUTE ON FUNCTION manual_trigger_strava_crawler() TO authenticated; 