drop function if exists claim_next_activity_for_segment_sync(bigint);

create or replace function claim_next_activity_for_segment_sync(p_strava_id bigint)
returns table (
  id uuid,
  activity_id bigint,
  name text
)
language plpgsql
security definer
as $$
declare
  v_id uuid;
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
