-- Add missing fields to segment_efforts table from Strava API
-- These fields are included in the segment_efforts array from GET /activities/{id}
-- but were not being stored in our database

-- Add performance and tracking fields
ALTER TABLE segment_efforts
  ADD COLUMN IF NOT EXISTS distance NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS start_index INTEGER,
  ADD COLUMN IF NOT EXISTS end_index INTEGER,
  ADD COLUMN IF NOT EXISTS average_cadence NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS average_heartrate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS max_heartrate INTEGER,
  ADD COLUMN IF NOT EXISTS pr_rank INTEGER,
  ADD COLUMN IF NOT EXISTS kom_rank INTEGER,
  ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_segment_efforts_pr_rank 
  ON segment_efforts(pr_rank) WHERE pr_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_segment_efforts_kom_rank 
  ON segment_efforts(kom_rank) WHERE kom_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_segment_efforts_hidden 
  ON segment_efforts(hidden) WHERE hidden = true;

CREATE INDEX IF NOT EXISTS idx_segment_efforts_distance 
  ON segment_efforts(distance);

-- Add column comments for documentation
COMMENT ON COLUMN segment_efforts.distance IS 'Effort distance in meters';
COMMENT ON COLUMN segment_efforts.start_index IS 'Start index in activity stream';
COMMENT ON COLUMN segment_efforts.end_index IS 'End index in activity stream';
COMMENT ON COLUMN segment_efforts.average_cadence IS 'Average cadence during effort (RPM)';
COMMENT ON COLUMN segment_efforts.average_heartrate IS 'Average heart rate during effort (BPM)';
COMMENT ON COLUMN segment_efforts.max_heartrate IS 'Maximum heart rate during effort (BPM)';
COMMENT ON COLUMN segment_efforts.pr_rank IS 'Personal record rank (1, 2, 3) or null';
COMMENT ON COLUMN segment_efforts.kom_rank IS 'KOM/QOM rank (1-10) or null';
COMMENT ON COLUMN segment_efforts.achievements IS 'JSON array of achievements earned on this effort';
COMMENT ON COLUMN segment_efforts.hidden IS 'Whether this effort is hidden from public view';
