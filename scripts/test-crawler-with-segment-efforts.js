const { StravaCrawlerService } = require('../lib/services/strava-crawler-service')

async function testCrawler() {
  console.log('🧪 Testing crawler with segment efforts tracking...')
  
  try {
    const crawlerService = new StravaCrawlerService()
    
    // Test the crawler with a small batch
    const result = await crawlerService.crawlStravaData({
      batch_size: 5,
      include_segments: true
    })
    
    console.log('✅ Crawler test completed!')
    console.log('📊 Results:')
    console.log(`   Users processed: ${result.users_processed}`)
    console.log(`   Users successful: ${result.users_successful}`)
    console.log(`   Total activities: ${result.total_activities}`)
    console.log(`   Total segments: ${result.total_segments}`)
    
    // Show individual user results
    result.results.forEach(userResult => {
      console.log(`   User ${userResult.user_name}: ${userResult.activities_fetched} activities, ${userResult.segments_fetched} segments, ${userResult.segment_efforts_fetched} segment efforts`)
    })
    
    // Get recent logs to verify segment_efforts_fetched column
    console.log('\n📋 Recent crawler logs:')
    const logs = await crawlerService.getRecentLogs(3)
    logs.forEach(log => {
      console.log(`   ${log.run_at}: ${log.status} - ${log.activities_fetched} activities, ${log.segments_fetched} segments, ${log.segment_efforts_fetched} segment efforts`)
    })
    
  } catch (error) {
    console.error('❌ Crawler test failed:', error)
  }
}

testCrawler() 