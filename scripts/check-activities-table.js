const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkActivitiesTable() {
  console.log('🔍 Checking activities table...');
  
  try {
    // Check table structure
    console.log('📋 Checking table structure...');
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .limit(5);
    
    if (activitiesError) {
      console.error('❌ Error querying activities:', activitiesError);
      return;
    }
    
    console.log(`📊 Found ${activities.length} activities in sample`);
    
    if (activities.length > 0) {
      console.log('📝 Sample activity structure:');
      console.log(JSON.stringify(activities[0], null, 2));
    }
    
    // Check if segments_fetched column exists
    console.log('🔍 Checking segments_fetched column...');
    const { data: segmentsCheck, error: segmentsError } = await supabase
      .from('activities')
      .select('segments_fetched')
      .limit(1);
    
    if (segmentsError) {
      console.error('❌ segments_fetched column error:', segmentsError);
    } else {
      console.log('✅ segments_fetched column is accessible');
    }
    
    // Count total activities
    const { count, error: countError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting activities:', countError);
    } else {
      console.log(`📊 Total activities in database: ${count}`);
    }
    
    // Check users table
    console.log('👥 Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
    
    if (usersError) {
      console.error('❌ Error querying users:', usersError);
    } else {
      console.log(`👥 Found ${users.length} users`);
      if (users.length > 0) {
        console.log('📝 Sample user:', JSON.stringify(users[0], null, 2));
      }
    }
    
    // Check strava_tokens table
    console.log('🔑 Checking strava_tokens table...');
    const { data: tokens, error: tokensError } = await supabase
      .from('strava_tokens')
      .select('*');
    
    if (tokensError) {
      console.error('❌ Error querying tokens:', tokensError);
    } else {
      console.log(`🔑 Found ${tokens.length} token records`);
      if (tokens.length > 0) {
        console.log('📝 Sample token record:', JSON.stringify(tokens[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkActivitiesTable().catch(console.error); 