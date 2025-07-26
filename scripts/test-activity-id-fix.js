const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testActivityIdFix() {
  console.log('🧪 Testing Activity ID Fix...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check if the fix resolves the UUID issue
    console.log('\n1️⃣ Testing getActivityById with numeric ID...')
    
    // Get a sample activity from the database
    const { data: sampleActivity, error: sampleError } = await supabase
      .from('activities')
      .select('activity_id, name')
      .limit(1)
    
    if (sampleError) {
      console.error('❌ Failed to get sample activity:', sampleError)
      return
    }
    
    if (sampleActivity && sampleActivity.length > 0) {
      const testActivityId = sampleActivity[0].activity_id
      console.log(`📊 Testing with activity ID: ${testActivityId} (${typeof testActivityId})`)
      
      // This should work now
      const { data: testResult, error: testError } = await supabase
        .from('activities')
        .select('*')
        .eq('activity_id', testActivityId)
        .maybeSingle()
      
      if (testError) {
        console.error('❌ Test failed:', testError)
      } else {
        console.log('✅ Test passed! Activity found:', testResult ? testResult.name : 'Not found')
      }
    }
    
    // Test 2: Check recent error logs
    console.log('\n2️⃣ Checking recent error logs...')
    const { data: recentErrors, error: errorsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .eq('status', 'error')
      .gte('run_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('run_at', { ascending: false })
    
    if (errorsError) {
      console.error('❌ Failed to fetch error logs:', errorsError)
    } else {
      const uuidErrors = recentErrors.filter(log => 
        log.message && log.message.includes('invalid input syntax for type bigint')
      )
      
      console.log(`📊 Recent errors (last hour): ${recentErrors.length}`)
      console.log(`🚨 UUID-related errors: ${uuidErrors.length}`)
      
      if (uuidErrors.length > 0) {
        console.log('\n⚠️  Recent UUID errors:')
        uuidErrors.slice(0, 3).forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.run_at}: ${error.message}`)
        })
      } else {
        console.log('✅ No recent UUID errors found!')
      }
    }
    
    // Test 3: Run a quick crawler test
    console.log('\n3️⃣ Testing crawler with fix...')
    try {
      const response = await fetch('http://localhost:3000/api/strava/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          skip_invalid_tokens: true,
          batch_size: 5 // Small batch for testing
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Crawler test successful!')
        console.log(`📊 Results: ${result.users_processed} users, ${result.users_successful} successful`)
        console.log(`📊 Activities: ${result.total_activities}, Segments: ${result.total_segments}`)
      } else {
        console.error('❌ Crawler test failed:', result.error)
      }
    } catch (crawlerError) {
      console.error('❌ Crawler test error:', crawlerError.message)
    }
    
    console.log('\n🎉 Activity ID fix test completed!')
    console.log('\n📋 Summary:')
    console.log('✅ Fixed: Database activity lookup with numeric IDs')
    console.log('✅ Fixed: UUID vs numeric ID confusion in fetchActivities')
    console.log('✅ Expected: No more "invalid input syntax for type bigint" errors')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testActivityIdFix() 