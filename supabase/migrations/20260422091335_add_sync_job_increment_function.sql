-- Migration: Add function to atomically increment sync job progress
-- Created: 2026-04-22

CREATE OR REPLACE FUNCTION increment_sync_job_progress(
  job_id UUID,
  entity_type TEXT,
  increment_by INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  UPDATE sync_jobs
  SET 
    progress = jsonb_set(
      progress,
      ARRAY[entity_type, 'processed'],
      to_jsonb((progress->entity_type->>'processed')::int + increment_by)
    ),
    processed_items = processed_items + increment_by,
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;
