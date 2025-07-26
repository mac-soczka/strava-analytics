const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSegmentsTable() {
  console.log('🔍 Checking segments and segment_efforts tables...');

  try {
    // Check segments table
    console.log('📋 Checking segments table...');
    const { data: segments, error: segmentsError } = await supabase
      .from('segments')
      .select('*')
      .limit(5);

    if (segmentsError) {
      console.error('❌ Error querying segments:', segmentsError);
      if (segmentsError.message.includes('relation "segments" does not exist')) {
        console.log('💡 The segments table does not exist. You may need to run the migration.');
      }
    } else {
      console.log(`📊 Found ${segments.length} segments in sample`);
      if (segments.length > 0) {
        console.log('📝 Sample segment structure:');
        console.log(JSON.stringify(segments[0], null, 2));
      }
    }

    // Check segment_efforts table
    console.log('📋 Checking segment_efforts table...');
    const { data: efforts, error: effortsError } = await supabase
      .from('segment_efforts')
      .select('*')
      .limit(5);

    if (effortsError) {
      console.error('❌ Error querying segment_efforts:', effortsError);
      if (effortsError.message.includes('relation "segment_efforts" does not exist')) {
        console.log('💡 The segment_efforts table does not exist. You may need to run the migration.');
      }
    } else {
      console.log(`📊 Found ${efforts.length} segment efforts in sample`);
      if (efforts.length > 0) {
        console.log('📝 Sample segment effort structure:');
        console.log(JSON.stringify(efforts[0], null, 2));
      }
    }

    // Count total records
    if (!segmentsError) {
      const { count: segmentsCount, error: countError } = await supabase
        .from('segments')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('❌ Error counting segments:', countError);
      } else {
        console.log(`📊 Total segments in database: ${segmentsCount}`);
      }
    }

    if (!effortsError) {
      const { count: effortsCount, error: countError } = await supabase
        .from('segment_efforts')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('❌ Error counting segment efforts:', countError);
      } else {
        console.log(`📊 Total segment efforts in database: ${effortsCount}`);
      }
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkSegmentsTable().catch(console.error); 