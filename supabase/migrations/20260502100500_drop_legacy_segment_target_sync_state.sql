-- Remove legacy table used by old segment-target sync approach.
-- Current activity-centric sync uses sync_jobs + strava_sync_state.
drop table if exists segment_target_sync_state;
