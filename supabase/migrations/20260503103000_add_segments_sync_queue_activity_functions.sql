-- Activity-centric counts and preview for dashboard "segments queue"
-- Replaces misuse of segment table vs user efforts (prior RPCs listed global unreconciled segments).

create or replace function public.needs_segment_fetch_work(a activities)
returns boolean
language sql
security invoker
as $$
  select
    a.segment_efforts_synced_at is null
    or coalesce(a.segments_fetched, false) is not true
    or a.segments_fetch_status is null
    or a.segments_fetch_status not in ('success_rows', 'success_empty')
$$;

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
        and a.activity_sync_state in ('pending', 'failed')
        and public.needs_segment_fetch_work(a)
        and coalesce(a.segments_fetch_status, '') is distinct from 'failed'
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

create or replace function public.get_user_segments_sync_queue_preview(
  p_strava_id bigint,
  p_order text default 'desc',
  p_limit integer default 50
)
returns table (
  activity_id bigint,
  name text,
  start_date timestamptz,
  activity_sync_state activity_sync_state,
  segments_fetch_status text,
  activity_sync_started_at timestamptz,
  queued_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.activity_id,
    coalesce(a.name, '')::text as name,
    a.start_date,
    a.activity_sync_state,
    a.segments_fetch_status::text as segments_fetch_status,
    a.activity_sync_started_at,
    coalesce(a.activity_sync_started_at, a.start_date) as queued_at
  from activities a
  where a.strava_id = p_strava_id
    and (
      public.needs_segment_fetch_work(a)
      or a.segments_fetch_status = 'failed'
    )
  order by
    case when a.activity_sync_state = 'in_progress' then 0
         when a.segments_fetch_status = 'failed' then 1
         when a.activity_sync_state = 'pending' then 2
         else 3
    end,
    case when lower(coalesce(trim(p_order), 'desc')) = 'asc'
         then coalesce(a.start_date, '-infinity'::timestamptz)
    end asc nulls last,
    case when lower(coalesce(trim(p_order), 'desc')) <> 'asc'
         then coalesce(a.start_date, '-infinity'::timestamptz)
    end desc nulls last,
    case when lower(coalesce(trim(p_order), 'desc')) = 'asc' then a.activity_id end asc,
    case when lower(coalesce(trim(p_order), 'desc')) <> 'asc' then a.activity_id end desc
  limit greatest(coalesce(p_limit, 50), 1)
$$;
