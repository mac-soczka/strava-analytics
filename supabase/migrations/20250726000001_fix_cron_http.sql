-- Enable http extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS http;

-- Drop the existing function and recreate it
DROP FUNCTION IF EXISTS trigger_strava_crawler();

-- Create a function to trigger the Strava crawler
CREATE OR REPLACE FUNCTION trigger_strava_crawler()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  response http_response;
BEGIN
  -- Call the Strava crawler via HTTP
  SELECT * INTO response
  FROM http((
    'POST',
    'https://strava-heatmap-alpha.vercel.app/api/strava/crawl',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    '{}'
  ));
  
  -- Parse the response
  result := response.content::json;
  
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

-- Update the manual trigger function
DROP FUNCTION IF EXISTS manual_trigger_strava_crawler();

CREATE OR REPLACE FUNCTION manual_trigger_strava_crawler()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN trigger_strava_crawler();
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION manual_trigger_strava_crawler() TO authenticated; 