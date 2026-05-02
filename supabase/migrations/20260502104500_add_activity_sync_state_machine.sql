do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_sync_state') then
    create type activity_sync_state as enum ('pending', 'in_progress', 'completed', 'failed');
  end if;
end
$$;

alter table activities
  add column if not exists activity_sync_state activity_sync_state not null default 'pending',
  add column if not exists activity_sync_started_at timestamptz,
  add column if not exists activity_sync_completed_at timestamptz,
  add column if not exists activity_sync_error text,
  add column if not exists activity_sync_attempts integer not null default 0;

update activities
set
  activity_sync_state = 'completed',
  activity_sync_completed_at = coalesce(activity_sync_completed_at, segment_efforts_synced_at, segments_fetched_at, now()),
  activity_sync_error = null
where
  segment_efforts_synced_at is not null
  and segments_fetch_status in ('success_rows', 'success_empty');

update activities
set
  activity_sync_state = 'pending',
  activity_sync_completed_at = null
where
  segment_efforts_synced_at is null
  and activity_sync_state = 'completed';

create index if not exists idx_activities_strava_sync_state_start_date
  on activities (strava_id, activity_sync_state, start_date asc, activity_id asc);

create index if not exists idx_activities_strava_in_progress_started_at
  on activities (strava_id, activity_sync_state, activity_sync_started_at asc nulls first);

create or replace function claim_next_activity_for_segment_sync(p_strava_id bigint)
returns table (
  id bigint,
  activity_id bigint,
  name text
)
language plpgsql
security definer
as $$
declare
  v_id bigint;
begin
  select a.id
  into v_id
  from activities a
  where a.strava_id = p_strava_id
    and a.activity_sync_state = 'in_progress'
  order by a.activity_sync_started_at asc nulls first, a.start_date asc, a.activity_id asc
  limit 1
  for update skip locked;

  if v_id is null then
    select a.id
    into v_id
    from activities a
    where a.strava_id = p_strava_id
      and a.activity_sync_state in ('pending', 'failed')
      and (
        a.segments_fetch_status in ('pending', 'failed')
        or a.segments_fetch_status is null
        or a.segments_fetched = false
        or a.segment_efforts_synced_at is null
      )
    order by a.start_date asc, a.activity_id asc
    limit 1
    for update skip locked;

    if v_id is not null then
      update activities
      set
        activity_sync_state = 'in_progress',
        activity_sync_started_at = now(),
        activity_sync_completed_at = null,
        activity_sync_error = null,
        activity_sync_attempts = coalesce(activity_sync_attempts, 0) + 1
      where activities.id = v_id;
    end if;
  end if;

  if v_id is null then
    return;
  end if;

  return query
  select a.id, a.activity_id, a.name
  from activities a
  where a.id = v_id;
end
$$;
