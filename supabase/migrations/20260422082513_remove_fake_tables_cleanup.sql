-- Migration: Remove fake/test tables that weren't properly cleaned up
-- Created: 2026-04-22

-- Drop fake tables if they exist
DROP TABLE IF EXISTS fake_post_categories CASCADE;
DROP TABLE IF EXISTS fake_posts CASCADE;
DROP TABLE IF EXISTS fake_categories CASCADE;
DROP TABLE IF EXISTS fake_users CASCADE;

-- Verify cleanup
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'fake_%'
  ) THEN
    RAISE NOTICE 'Warning: Some fake tables still exist';
  ELSE
    RAISE NOTICE 'All fake tables successfully removed';
  END IF;
END $$;
