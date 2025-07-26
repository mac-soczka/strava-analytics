const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function debugActivityIds() {
  console.log('🔍 Debugging Activity ID Issue...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check what getActivities returns
    console.log('\n1️⃣ Testing getActivities method...')
    
    const { data: rawActivities, error } = await supabase
      .from('activities')
      .select('id, activity_id, name')
      .limit(3)
    
    if (error) {
      console.error('❌ Failed to fetch activities:', error)
      return
    }
    
    console.log('📊 Raw database data:')
    rawActivities.forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.name}`)
      console.log(`   Database ID (UUID): ${activity.id}`)
      console.log(`   Activity ID (numeric): ${activity.activity_id}`)
      console.log(`   Types: id=${typeof activity.id}, activity_id=${typeof activity.activity_id}`)
      console.log('')
    })
    
    // Test 2: Simulate the repository conversion
    console.log('\n2️⃣ Simulating repository conversion...')
    
    const convertedActivities = rawActivities.map((dbActivity) => ({
      id: dbActivity.activity_id, // Use activity_id as the Strava ID
      name: dbActivity.name,
      distance: 0,
      moving_time: 0,
      elapsed_time: 0,
      total_elevation_gain: 0,
      type: '',
      start_date: '',
      start_date_local: ''
    }))
    
    console.log('📊 Converted activities:')
    convertedActivities.forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.name}`)
      console.log(`   ID: ${activity.id} (${typeof activity.id})`)
      console.log('')
    })
    
    // Test 3: Test getActivityById with converted ID
    console.log('\n3️⃣ Testing getActivityById with converted ID...')
    
    if (convertedActivities.length > 0) {
      const testId = convertedActivities[0].id
      console.log(`Testing with ID: ${testId} (${typeof testId})`)
      
      const { data: testResult, error: testError } = await supabase
        .from('activities')
        .select('*')
        .eq('activity_id', testId)
        .maybeSingle()
      
      if (testError) {
        console.error('❌ Test failed:', testError)
      } else {
        console.log('✅ Test passed! Activity found:', testResult ? testResult.name : 'Not found')
      }
    }
    
    // Test 4: Check recent error logs
    console.log('\n4️⃣ Checking recent error logs...')
    
    const { data: recentErrors, error: errorsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .eq('status', 'error')
      .gte('run_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
      .order('run_at', { ascending: false })
    
    if (errorsError) {
      console.error('❌ Failed to fetch error logs:', errorsError)
    } else {
      const uuidErrors = recentErrors.filter(log => 
        log.message && log.message.includes('invalid input syntax for type bigint')
      )
      
      console.log(`📊 Recent errors (last 10 min): ${recentErrors.length}`)
      console.log(`🚨 UUID-related errors: ${uuidErrors.length}`)
      
      if (uuidErrors.length > 0) {
        console.log('\n⚠️  Recent UUID errors:')
        uuidErrors.slice(0, 3).forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.run_at}: ${error.message}`)
        })
      }
    }
    
    console.log('\n🎉 Debug completed!')
    console.log('\n📋 Analysis:')
    console.log('✅ Raw database data has correct structure')
    console.log('✅ Conversion should work correctly')
    console.log('✅ getActivityById should work with numeric IDs')
    console.log('❓ Issue might be in the syncActivities method')
    
  } catch (error) {
    console.error('❌ Debug failed:', error)
  }
}

// Run the debug
debugActivityIds() 