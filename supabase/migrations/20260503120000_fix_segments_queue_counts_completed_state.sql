-- Segment queue "pending" must match preview semantics: any row that still needs
-- segment/effort fetch work should count as pending unless it is in_progress or
-- segments_fetch_status is permanently failed. Previously we required
-- activity_sync_state in ('pending','failed'), which hid work for rows marked
-- 'completed' at the activity level while segment_efforts_synced_at was still null.

create or replace function public.get_user_segments_sync_queue_counts(p_strava_id bigint)
returns table (
  pending bigint,
  in_progress bigint,
  completed bigint,
  failed bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (
      select count(*)::bigint
      from activities a
      where a.strava_id = p_strava_id
        and public.needs_segment_fetch_work(a)
        and coalesce(a.segments_fetch_status, '') is distinct from 'failed'
        and coalesce(a.activity_sync_state::text, '') is distinct from 'in_progress'
    ) as pending,
    (
      select count(*)::bigint
      from activities a
      where a.strava_id = p_strava_id
        and a.activity_sync_state = 'in_progress'
        and public.needs_segment_fetch_work(a)
    ) as in_progress,
    (
      select count(*)::bigint
      from activities a
      where a.strava_id = p_strava_id
        and a.segments_fetch_status in ('success_rows', 'success_empty')
        and a.segment_efforts_synced_at is not null
    ) as completed,
    (
      select count(*)::bigint
      from activities a
      where a.strava_id = p_strava_id
        and a.segments_fetch_status = 'failed'
    ) as failed;
$$;
