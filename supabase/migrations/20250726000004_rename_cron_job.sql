-- Rename the cron job to be more descriptive since it now runs every 15 minutes
-- This provides better clarity about the job's purpose and frequency

-- Unschedule the old job
SELECT cron.unschedule('strava-crawler-daily');

-- Schedule the job with a new name that reflects its frequency
-- Cron format: '*/15 * * * *' = Every 15 minutes
SELECT cron.schedule(
    'strava-crawler-15min',
    '*/15 * * * *',
    'SELECT trigger_strava_crawler_direct();'
);

-- Update the manual trigger function to use the new job name
DROP FUNCTION IF EXISTS manual_trigger_strava_crawler();

CREATE OR REPLACE FUNCTION manual_trigger_strava_crawler()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Call the crawler function directly
    PERFORM trigger_strava_crawler_direct();
    
    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Strava crawler triggered manually. Check strava_crawler_logs for results.',
        'timestamp', now()
    );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION manual_trigger_strava_crawler() TO authenticated;

-- Add comments for clarity
COMMENT ON FUNCTION trigger_strava_crawler_direct() IS 'Strava crawler trigger - runs every 15 minutes via cron job strava-crawler-15min';
COMMENT ON FUNCTION manual_trigger_strava_crawler() IS 'Manual trigger for Strava crawler - calls trigger_strava_crawler_direct() directly'; 