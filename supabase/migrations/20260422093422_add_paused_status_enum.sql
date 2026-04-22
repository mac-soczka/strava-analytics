-- Migration: Add 'paused' status to sync_job_status enum
-- Created: 2026-04-22
-- Note: This must be in a separate migration from other changes

ALTER TYPE sync_job_status ADD VALUE 'paused';
