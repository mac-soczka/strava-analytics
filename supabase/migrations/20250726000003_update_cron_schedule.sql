-- Update Strava crawler cron schedule to run every 15 minutes
-- This replaces the daily schedule with a more frequent one for better data freshness

-- Unschedule the current daily job
SELECT cron.unschedule('strava-crawler-daily');

-- Schedule the job to run every 15 minutes
-- Cron format: '*/15 * * * *' = Every 15 minutes
SELECT cron.schedule(
    'strava-crawler-daily',
    '*/15 * * * *',
    'SELECT trigger_strava_crawler_direct();'
);

-- Add a comment explaining the schedule
COMMENT ON FUNCTION trigger_strava_crawler_direct() IS 'Strava crawler trigger - runs every 15 minutes via cron job strava-crawler-daily'; 