-- Migration: Drop polyline index that causes errors with large polylines
-- Created: 2026-04-22
-- Issue: Polyline strings can exceed PostgreSQL B-tree index size limit (2704 bytes)
-- Solution: Drop the index - polyline searches are rare and can use table scans

-- Drop the problematic index
DROP INDEX IF EXISTS idx_activities_polyline;

-- Note: If polyline searches become necessary, consider:
-- 1. Using a hash index: CREATE INDEX idx_activities_polyline_hash ON activities USING hash(polyline);
-- 2. Using MD5 hash: CREATE INDEX idx_activities_polyline_md5 ON activities(md5(polyline));
-- 3. Using full-text search for pattern matching
-- For now, we don't need to index polylines as they're primarily used for display, not searching.
