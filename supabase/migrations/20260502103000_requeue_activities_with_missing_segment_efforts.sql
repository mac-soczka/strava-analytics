update activities a
set
  activity_sync_state = 'pending',
  activity_sync_started_at = null,
  activity_sync_completed_at = null,
  activity_sync_error = 'requeued: success_rows without persisted segment_efforts',
  segments_fetch_status = 'pending',
  segments_fetched_at = null,
  segment_efforts_synced_at = null,
  segments_fetch_error = 'requeued: success_rows without persisted segment_efforts',
  segments_effort_rows_count = null
where
  a.segments_fetch_status = 'success_rows'
  and not exists (
    select 1
    from segment_efforts se
    where se.activity_id = a.activity_id
  );
