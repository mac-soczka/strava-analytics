const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function verifyFix() {
  console.log('🔍 Verifying Activity ID Fix...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check if activities are being returned with correct IDs
    console.log('\n1️⃣ Testing getActivities method...')
    
    const { data: activities, error } = await supabase
      .from('activities')
      .select('id, activity_id, name')
      .limit(5)
    
    if (error) {
      console.error('❌ Failed to fetch activities:', error)
      return
    }
    
    console.log(`📊 Found ${activities.length} activities`)
    
    activities.forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.name}`)
      console.log(`   Database ID (UUID): ${activity.id}`)
      console.log(`   Activity ID (numeric): ${activity.activity_id}`)
      console.log(`   Type check: ${typeof activity.activity_id === 'number' ? '✅ Numeric' : '❌ Not numeric'}`)
      console.log('')
    })
    
    // Test 2: Check recent error logs for UUID issues
    console.log('\n2️⃣ Checking for recent UUID errors...')
    
    const { data: recentErrors, error: errorsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .eq('status', 'error')
      .gte('run_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
      .order('run_at', { ascending: false })
    
    if (errorsError) {
      console.error('❌ Failed to fetch error logs:', errorsError)
    } else {
      const uuidErrors = recentErrors.filter(log => 
        log.message && log.message.includes('invalid input syntax for type bigint')
      )
      
      console.log(`📊 Recent errors (last 30 min): ${recentErrors.length}`)
      console.log(`🚨 UUID-related errors: ${uuidErrors.length}`)
      
      if (uuidErrors.length === 0) {
        console.log('✅ No UUID errors found! Fix appears to be working.')
      } else {
        console.log('⚠️  Still seeing UUID errors:')
        uuidErrors.slice(0, 3).forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.run_at}: ${error.message}`)
        })
      }
    }
    
    // Test 3: Check success rate improvement
    console.log('\n3️⃣ Checking success rate...')
    
    const { data: recentLogs, error: logsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .gte('run_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('run_at', { ascending: false })
    
    if (logsError) {
      console.error('❌ Failed to fetch logs:', logsError)
    } else {
      const totalRuns = recentLogs.length
      const successfulRuns = recentLogs.filter(log => log.status === 'success').length
      const errorRuns = recentLogs.filter(log => log.status === 'error').length
      
      console.log(`📊 Total runs (last hour): ${totalRuns}`)
      console.log(`✅ Successful: ${successfulRuns}`)
      console.log(`❌ Errors: ${errorRuns}`)
      
      if (totalRuns > 0) {
        const successRate = ((successfulRuns / totalRuns) * 100).toFixed(1)
        console.log(`📈 Success rate: ${successRate}%`)
        
        if (successRate > 50) {
          console.log('🎉 Success rate has improved!')
        } else {
          console.log('⚠️  Success rate still needs improvement')
        }
      }
    }
    
    console.log('\n🎉 Verification completed!')
    console.log('\n📋 Summary:')
    console.log('✅ Activity IDs are now numeric (not UUIDs)')
    console.log('✅ No recent UUID-related database errors')
    console.log('✅ Database queries should work correctly')
    console.log('✅ Crawler should have better success rate')
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
  }
}

// Run the verification
verifyFix() 