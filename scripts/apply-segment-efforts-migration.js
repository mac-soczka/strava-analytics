const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyMigration() {
  console.log('🔄 Applying segment_efforts_fetched migration...')
  
  try {
    // Check if column already exists
    const { data: existingColumn, error: checkError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'strava_crawler_logs')
      .eq('column_name', 'segment_efforts_fetched')
      .single()
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking column existence:', checkError)
      return
    }
    
    if (existingColumn) {
      console.log('✅ Column segment_efforts_fetched already exists!')
      return
    }
    
    console.log('📝 Column does not exist, attempting to add it...')
    console.log('⚠️ Note: This migration requires manual execution in Supabase dashboard')
    console.log('📋 SQL to run:')
    console.log(`
ALTER TABLE strava_crawler_logs 
ADD COLUMN IF NOT EXISTS segment_efforts_fetched INTEGER DEFAULT 0;

UPDATE strava_crawler_logs 
SET segment_efforts_fetched = 0 
WHERE segment_efforts_fetched IS NULL;

CREATE INDEX IF NOT EXISTS idx_crawler_logs_segment_efforts_fetched 
ON strava_crawler_logs(segment_efforts_fetched);
    `)
    
  } catch (error) {
    console.error('❌ Migration check failed:', error)
  }
}

applyMigration() 