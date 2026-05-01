-- Migration: Allow multiple efforts per (activity_id, segment_id)
-- Created: 2026-05-01
--
-- Rationale:
-- A single activity can legitimately contain multiple efforts on the same segment
-- (e.g., repeats/loops). Enforcing UNIQUE(activity_id, segment_id) causes valid
-- inserts to fail with 23505 and wastes sync attempts.
--
-- Idempotency is already enforced by effort_id_text unique constraints.

ALTER TABLE segment_efforts
  DROP CONSTRAINT IF EXISTS segment_efforts_activity_id_segment_id_key;

-- In case the uniqueness was created as a standalone index in some environments.
DROP INDEX IF EXISTS segment_efforts_activity_id_segment_id_key;

