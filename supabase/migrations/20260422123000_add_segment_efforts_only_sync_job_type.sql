-- Migration: Add segment_efforts_only sync job type
-- Created: 2026-04-22

ALTER TYPE sync_job_type ADD VALUE IF NOT EXISTS 'segment_efforts_only';

