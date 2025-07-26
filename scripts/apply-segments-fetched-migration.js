const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applySegmentsFetchedMigration() {
  console.log('🔧 Applying segments_fetched column migration...');
  
  try {
    // Try to add the column (will fail if it already exists, which is fine)
    console.log('📝 Adding segments_fetched column...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE activities 
        ADD COLUMN IF NOT EXISTS segments_fetched BOOLEAN DEFAULT FALSE;
      `
    });
    
    if (alterError) {
      console.log('ℹ️ Column might already exist or error occurred:', alterError.message);
    } else {
      console.log('✅ Column added successfully');
    }
    
    // Try to create index (will fail if it already exists, which is fine)
    console.log('📝 Creating index...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_activities_segments_fetched ON activities(segments_fetched);
      `
    });
    
    if (indexError) {
      console.log('ℹ️ Index might already exist or error occurred:', indexError.message);
    } else {
      console.log('✅ Index created successfully');
    }
    
    // Try to update existing activities
    console.log('📝 Updating existing activities...');
    const { error: updateError } = await supabase
      .from('activities')
      .update({ segments_fetched: false })
      .is('segments_fetched', null);
    
    if (updateError) {
      console.log('ℹ️ Update error (might be no activities or column issue):', updateError.message);
    } else {
      console.log('✅ Activities updated successfully');
    }
    
    // Test if the column works by trying to query it
    console.log('🧪 Testing column access...');
    const { data: testData, error: testError } = await supabase
      .from('activities')
      .select('segments_fetched')
      .limit(1);
    
    if (testError) {
      console.error('❌ Column test failed:', testError.message);
      console.log('💡 The segments_fetched column might not exist yet');
    } else {
      console.log('✅ Column test successful - segments_fetched column is accessible');
    }
    
    console.log('🎉 Migration process completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

applySegmentsFetchedMigration().catch(console.error); 