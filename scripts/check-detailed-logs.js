const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkDetailedLogs() {
  console.log('🔍 Checking detailed crawler logs...\n')

  try {
    // Get recent logs with all fields
    const { data: logs, error } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('❌ Error fetching logs:', error)
      return
    }

    console.log(`✅ Found ${logs.length} recent logs\n`)

    logs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.run_at} - User: ${log.user_id || 'N/A'} - Status: ${log.status}`)
      console.log(`   Activities: ${log.activities_fetched}, Segments: ${log.segments_fetched}, Efforts: ${log.segment_efforts_fetched}`)
      console.log(`   Execution Time: ${log.execution_time_ms}ms`)
      console.log(`   Message: ${log.message}`)
      
      if (log.rate_limit_status) {
        const rl = log.rate_limit_status
        console.log(`   Rate Limit: ${rl.mode} - 15min: ${rl.requests15min}/${rl.limit15min}, Day: ${rl.requestsDay}/${rl.limitDay}`)
      } else {
        console.log(`   Rate Limit: Not recorded`)
      }
      
      if (log.error) {
        console.log(`   Error: ${log.error}`)
      }
      console.log('')
    })

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkDetailedLogs() 