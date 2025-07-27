const { StravaCrawlerService } = require('../lib/services/strava-crawler-service.ts')
require('dotenv').config({ path: '.env.local' })

async function testCrawlerSimple() {
  console.log('🧪 Testing Crawler Service Directly...\n')

  try {
    const crawlerService = new StravaCrawlerService()
    
    console.log('📋 Testing with skip_invalid_tokens=true (should be fast)...')
    
    const startTime = Date.now()
    const result = await crawlerService.crawlStravaData({
      skip_invalid_tokens: true
    })
    const totalTime = Date.now() - startTime
    
    console.log('✅ Crawler completed!')
    console.log('📊 Results:')
    console.log(`  Success: ${result.success}`)
    console.log(`  Users processed: ${result.users_processed}`)
    console.log(`  Users successful: ${result.users_successful}`)
    console.log(`  Total activities: ${result.total_activities}`)
    console.log(`  Total segments: ${result.total_segments}`)
    console.log(`  Total execution time: ${totalTime}ms`)
    
    // Check recent logs
    console.log('\n📋 Checking recent logs...')
    const logs = await crawlerService.getRecentLogs(3)
    
    logs.forEach((log, i) => {
      console.log(`\n${i + 1}. ${log.run_at} - Status: ${log.status}`)
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
    })

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testCrawlerSimple() 