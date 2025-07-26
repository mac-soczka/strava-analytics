const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testCronSetup() {
  console.log('🧪 Testing Supabase Cron Setup...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check if pg_cron extension is enabled
    console.log('\n1️⃣ Checking pg_cron extension...')
    const { data: extensions, error: extError } = await supabase
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'pg_cron')
    
    if (extError) {
      console.log('ℹ️  Using alternative method to check pg_cron...')
    } else {
      console.log('✅ pg_cron extension is available')
    }
    
    // Test 2: Check if cron jobs exist
    console.log('\n2️⃣ Checking existing cron jobs...')
    const { data: jobs, error: jobsError } = await supabase
      .rpc('cron_job_list')
    
    if (jobsError) {
      console.log('ℹ️  Using SQL query to check cron jobs...')
      const { data: cronJobs, error } = await supabase
        .rpc('exec_sql', { sql: "SELECT * FROM cron.job WHERE command LIKE '%strava%'" })
      
      if (error) {
        console.log('⚠️  Could not check cron jobs directly')
      } else {
        console.log('📋 Found cron jobs:', cronJobs)
      }
    } else {
      console.log('📋 Found cron jobs:', jobs)
    }
    
    // Test 3: Test manual trigger function
    console.log('\n3️⃣ Testing manual trigger function...')
    const { data: triggerResult, error: triggerError } = await supabase
      .rpc('manual_trigger_strava_crawler')
    
    if (triggerError) {
      console.error('❌ Manual trigger failed:', triggerError)
    } else {
      console.log('✅ Manual trigger successful:', triggerResult)
    }
    
    // Test 4: Check recent crawler logs
    console.log('\n4️⃣ Checking recent crawler logs...')
    const { data: logs, error: logsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(5)
    
    if (logsError) {
      console.error('❌ Could not fetch logs:', logsError)
    } else {
      console.log('📊 Recent crawler logs:', logs)
    }
    
    console.log('\n✅ Cron setup test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testCronSetup() 