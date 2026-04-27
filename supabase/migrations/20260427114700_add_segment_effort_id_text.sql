-- Migration: Add text-safe effort id for segment efforts
-- Created: 2026-04-27

ALTER TABLE segment_efforts
  ADD COLUMN IF NOT EXISTS effort_id_text TEXT;

-- Best-effort backfill from existing bigint.
UPDATE segment_efforts
SET effort_id_text = effort_id::text
WHERE effort_id_text IS NULL;

-- Ensure uniqueness for exact-once semantics based on Strava's effort id identity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_segment_efforts_effort_id_text_unique
  ON segment_efforts(effort_id_text)
  WHERE effort_id_text IS NOT NULL;

