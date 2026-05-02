drop function if exists public.get_user_segment_queue_counts(bigint);

create function public.get_user_segment_queue_counts(user_strava_id bigint)
returns table (
  pending_segments integer,
  in_progress_segments integer,
  completed_segments integer,
  failed_segments integer
)
language sql
security definer
as $$
  with completed as (
    select count(distinct se.segment_id)::integer as completed_segments
    from segment_efforts se
    join activities a on a.activity_id = se.activity_id
    where a.strava_id = user_strava_id
  ),
  total as (
    select count(*)::integer as total_segments
    from segments
  )
  select
    greatest(total.total_segments - completed.completed_segments, 0) as pending_segments,
    0::integer as in_progress_segments,
    completed.completed_segments as completed_segments,
    0::integer as failed_segments
  from completed, total;
$$;
