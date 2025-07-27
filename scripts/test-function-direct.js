const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testFunctionDirect() {
  console.log('🧪 Testing Function Directly via SQL...\n')

  try {
    // Call the function directly via SQL
    const { data, error } = await supabase
      .rpc('trigger_strava_crawler_direct')

    if (error) {
      console.error('❌ Function call failed:', error)
      return
    }

    console.log('✅ Function Response:')
    console.log(JSON.stringify(data, null, 2))

    // Wait a moment and check the logs
    console.log('\n📋 Checking recent logs...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const { data: logs, error: logsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(3)

    if (logsError) {
      console.error('❌ Error fetching logs:', logsError)
      return
    }

    console.log(`✅ Found ${logs?.length || 0} recent logs`)
    if (logs && logs.length > 0) {
      console.log('Recent logs:')
      logs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.run_at} - Status: ${log.status}`)
        console.log(`     Activities: ${log.activities_fetched}, Segments: ${log.segments_fetched}`)
        console.log(`     Message: ${log.message}`)
        if (log.error) console.log(`     Error: ${log.error}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('❌ Error calling function:', error)
  }
}

testFunctionDirect() 