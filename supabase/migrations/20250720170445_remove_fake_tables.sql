-- Migration: 20250720170445_remove_fake_tables.sql
-- Description: Remove all fake tables and related objects
-- This migration cleans up the fake tables created for testing

-- Drop the view first (depends on tables)
DROP VIEW IF EXISTS fake_posts_with_details;

-- Drop junction table first (depends on both posts and categories)
DROP TABLE IF EXISTS fake_post_categories;

-- Drop main tables (in reverse order of dependencies)
DROP TABLE IF EXISTS fake_posts;
DROP TABLE IF EXISTS fake_categories;
DROP TABLE IF EXISTS fake_users;

-- Note: Indexes and RLS policies are automatically dropped with their tables
-- Note: Sample data is automatically removed when tables are dropped
