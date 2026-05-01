-- Migration: Add concrete unique constraint for effort_id_text
-- Created: 2026-05-01
--
-- We upsert segment efforts with onConflict: 'effort_id_text'. Postgres requires
-- a concrete unique constraint/index that exactly matches this target.

ALTER TABLE segment_efforts
  ADD CONSTRAINT segment_efforts_effort_id_text_key UNIQUE (effort_id_text);
