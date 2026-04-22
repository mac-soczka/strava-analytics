-- Migration: Add segments_only sync job type
-- Created: 2026-04-22

-- Add new job type for segments-only sync runs
ALTER TYPE sync_job_type ADD VALUE IF NOT EXISTS 'segments_only';

