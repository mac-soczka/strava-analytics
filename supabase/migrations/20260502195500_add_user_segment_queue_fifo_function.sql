drop function if exists public.get_user_segment_queue_fifo(bigint);

create function public.get_user_segment_queue_fifo(user_strava_id bigint)
returns table (
  segment_id bigint,
  name text,
  created_at timestamptz
)
language sql
security definer
as $$
  select
    s.segment_id,
    coalesce(s.name, 'Unknown')::text as name,
    s.created_at
  from segments s
  where not exists (
    select 1
    from segment_efforts se
    join activities a on a.activity_id = se.activity_id
    where a.strava_id = user_strava_id
      and se.segment_id = s.segment_id
  )
  order by s.created_at asc, s.segment_id asc;
$$;
