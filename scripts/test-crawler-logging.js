const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testCrawlerLogging() {
  console.log('🧪 Testing Crawler Logging Consistency...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check for logs with NULL user_id that should have user_id
    console.log('\n1️⃣ Checking for logs with missing user_id...')
    const { data: logs, error } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('❌ Failed to fetch logs:', error)
      return
    }

    // Filter for user-specific logs that should have user_id
    const userSpecificLogs = logs.filter((log) => {
      const message = log.message?.toLowerCase() || ''
      return (
        message.includes('synced') ||
        message.includes('activities') ||
        message.includes('segments') ||
        message.includes('refresh token') ||
        message.includes('authentication') ||
        (message.includes('user') && !message.includes('cron job'))
      )
    })

    const logsWithoutUserId = userSpecificLogs.filter((log) => log.user_id === null)

    console.log(`📊 Total logs analyzed: ${logs.length}`)
    console.log(`👥 User-specific logs: ${userSpecificLogs.length}`)
    console.log(`❌ Logs missing user_id: ${logsWithoutUserId.length}`)

    if (logsWithoutUserId.length > 0) {
      console.log('\n🚨 PROBLEM FOUND: Logs with missing user_id:')
      logsWithoutUserId.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.run_at} - ${log.status}`)
        console.log(`     Message: ${log.message}`)
        console.log(`     User ID: ${log.user_id}`)
        console.log('')
      })
    } else {
      console.log('✅ All user-specific logs have proper user_id!')
    }

    // Test 2: Check for "user undefined" in error messages
    console.log('\n2️⃣ Checking for "user undefined" in error messages...')
    const errorLogs = logs.filter((log) => 
      log.status === 'error' && log.message?.includes('user undefined')
    )

    console.log(`🚨 Error logs with "user undefined": ${errorLogs.length}`)

    if (errorLogs.length > 0) {
      console.log('\n🚨 PROBLEM FOUND: Error logs with "user undefined":')
      errorLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.run_at} - User ID: ${log.user_id}`)
        console.log(`     Message: ${log.message}`)
        console.log('')
      })
    } else {
      console.log('✅ No error logs with "user undefined" found!')
    }

    // Test 3: Check for inconsistent user_id in message vs log
    console.log('\n3️⃣ Checking for user_id consistency in messages...')
    const userLogsWithId = userSpecificLogs.filter((log) => log.user_id !== null)

    const inconsistentLogs = userLogsWithId.filter((log) => {
      if (!log.message || !log.user_id) return false
      
      const messageUserId = log.message.match(/user (\d+)/)?.[1]
      if (!messageUserId) return false
      
      return messageUserId !== log.user_id.toString()
    })

    console.log(`🚨 Logs with inconsistent user_id: ${inconsistentLogs.length}`)

    if (inconsistentLogs.length > 0) {
      console.log('\n🚨 PROBLEM FOUND: Logs with inconsistent user_id:')
      inconsistentLogs.forEach((log, index) => {
        const messageUserId = log.message.match(/user (\d+)/)?.[1]
        console.log(`  ${index + 1}. ${log.run_at}`)
        console.log(`     Log user_id: ${log.user_id}`)
        console.log(`     Message user_id: ${messageUserId}`)
        console.log(`     Message: ${log.message}`)
        console.log('')
      })
    } else {
      console.log('✅ All user_id values are consistent!')
    }

    // Test 4: Check system logs (should be allowed to have null user_id)
    console.log('\n4️⃣ Checking system logs...')
    const systemLogs = logs.filter((log) => {
      const message = log.message?.toLowerCase() || ''
      return message.includes('cron job') || message.includes('scheduled')
    })

    const systemLogsWithUserId = systemLogs.filter((log) => log.user_id !== null)

    console.log(`📊 System logs: ${systemLogs.length}`)
    console.log(`👥 System logs with user_id: ${systemLogsWithUserId.length}`)

    if (systemLogsWithUserId.length > 0) {
      console.log('\n⚠️  NOTE: Some system logs have user_id (this might be expected):')
      systemLogsWithUserId.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.run_at} - User ID: ${log.user_id}`)
        console.log(`     Message: ${log.message}`)
        console.log('')
      })
    }

    // Summary
    console.log('\n📋 SUMMARY:')
    console.log(`✅ Total logs analyzed: ${logs.length}`)
    console.log(`✅ User-specific logs: ${userSpecificLogs.length}`)
    console.log(`❌ Missing user_id: ${logsWithoutUserId.length}`)
    console.log(`❌ "user undefined" errors: ${errorLogs.length}`)
    console.log(`❌ Inconsistent user_id: ${inconsistentLogs.length}`)
    console.log(`📊 System logs: ${systemLogs.length}`)

    const totalIssues = logsWithoutUserId.length + errorLogs.length + inconsistentLogs.length
    
    if (totalIssues === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Crawler logging is consistent.')
    } else {
      console.log(`\n🚨 ${totalIssues} ISSUES FOUND! Please review the problems above.`)
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testCrawlerLogging() 