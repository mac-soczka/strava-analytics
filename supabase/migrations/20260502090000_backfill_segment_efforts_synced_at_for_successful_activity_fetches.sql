-- Backfill segment_efforts_synced_at for activities already marked as successful
-- so ensure_segments/ensure_segment_efforts does not re-queue completed rows.
update activities
set segment_efforts_synced_at = coalesce(segment_efforts_synced_at, segments_fetched_at, now())
where segments_fetch_status in ('success_rows', 'success_empty')
  and segment_efforts_synced_at is null;
