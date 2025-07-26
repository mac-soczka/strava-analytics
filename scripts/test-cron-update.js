const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testCronUpdate() {
  console.log('🧪 Testing Cron Schedule Update...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check if manual trigger function works
    console.log('1️⃣ Testing manual trigger function...')
    const { data: triggerResult, error: triggerError } = await supabase.rpc('manual_trigger_strava_crawler')
    
    if (triggerError) {
      console.error('❌ Manual trigger failed:', triggerError)
    } else {
      console.log('✅ Manual trigger successful:', triggerResult)
    }
    
    // Test 2: Check recent crawler logs
    console.log('2️⃣ Checking recent crawler logs...')
    const { data: logs, error: logsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(5)
    
    if (logsError) {
      console.error('❌ Failed to fetch crawler logs:', logsError)
    } else {
      console.log('📋 Recent crawler logs:')
      if (logs && logs.length > 0) {
        logs.forEach((log, index) => {
          console.log(`  ${index + 1}. ${log.run_at} - ${log.status}`)
          console.log(`     Message: ${log.message}`)
          console.log(`     Activities: ${log.activities_fetched}, Segments: ${log.segments_fetched}`)
          console.log('')
        })
      } else {
        console.log('  No recent crawler logs found')
      }
    }
    
    // Test 3: Check if the trigger_strava_crawler_direct function exists
    console.log('3️⃣ Testing direct trigger function...')
    const { data: directResult, error: directError } = await supabase.rpc('trigger_strava_crawler_direct')
    
    if (directError) {
      console.error('❌ Direct trigger failed:', directError)
    } else {
      console.log('✅ Direct trigger successful:', directResult)
    }
    
    console.log('\n🎉 Cron update test completed!')
    console.log('📅 The crawler should now run every 15 minutes')
    console.log('🕐 Next automatic run: Within 15 minutes from now')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testCronUpdate() 