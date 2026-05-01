-- Migration: Add oldest-first cursor to segment target sync state
-- Created: 2026-05-01

ALTER TABLE segment_target_sync_state
  ADD COLUMN IF NOT EXISTS backfill_after_epoch INTEGER;

