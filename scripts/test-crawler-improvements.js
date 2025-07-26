const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testCrawlerImprovements() {
  console.log('🧪 Testing Crawler Improvements...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check entity statistics
    console.log('\n1️⃣ Testing Entity Statistics...')
    const response = await fetch('http://localhost:3000/api/strava/crawler/entity-stats')
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Entity stats loaded successfully')
      console.log('📊 Totals:', data.stats.totals)
      console.log('🔄 Recent Activity:', data.stats.recent_activity)
      console.log('📈 Summary:', data.stats.summary)
    } else {
      console.error('❌ Failed to load entity stats:', data.error)
    }
    
    // Test 2: Check recent crawler logs for proper tracking
    console.log('\n2️⃣ Checking Recent Crawler Logs...')
    const { data: logs, error: logsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(5)
    
    if (logsError) {
      console.error('❌ Failed to fetch logs:', logsError)
    } else {
      console.log('📋 Recent logs:')
      logs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.run_at} - ${log.status} - Activities: ${log.activities_fetched}, Segments: ${log.segments_fetched}`)
        if (log.message) {
          console.log(`     Message: ${log.message}`)
        }
      })
    }
    
    // Test 3: Check database counts
    console.log('\n3️⃣ Checking Database Counts...')
    const [activitiesCount, segmentsCount, segmentEffortsCount, usersCount] = await Promise.all([
      supabase.from('activities').select('*', { count: 'exact', head: true }),
      supabase.from('segments').select('*', { count: 'exact', head: true }),
      supabase.from('segment_efforts').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true })
    ])
    
    console.log('📊 Database Counts:')
    console.log(`  Activities: ${activitiesCount.count || 0}`)
    console.log(`  Segments: ${segmentsCount.count || 0}`)
    console.log(`  Segment Efforts: ${segmentEffortsCount.count || 0}`)
    console.log(`  Users: ${usersCount.count || 0}`)
    
    console.log('\n✅ Crawler improvements test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testCrawlerImprovements() 