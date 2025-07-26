const { StravaCrawlerService } = require('../lib/services/strava-crawler-service')

async function testComprehensiveCrawler() {
  console.log('🧪 Testing comprehensive crawler...')
  
  try {
    const crawler = new StravaCrawlerService()
    
    // Test with comprehensive sync
    const result = await crawler.crawlStravaData({
      include_segments: true,
      skip_invalid_tokens: true
    })
    
    console.log('\n📊 Test Results:')
    console.log(`✅ Success: ${result.success}`)
    console.log(`👥 Users processed: ${result.users_processed}`)
    console.log(`✅ Users successful: ${result.users_successful}`)
    console.log(`📥 Total activities: ${result.total_activities}`)
    console.log(`🏁 Total segments: ${result.total_segments}`)
    
    console.log('\n📋 Individual Results:')
    result.results.forEach((userResult, index) => {
      console.log(`  ${index + 1}. ${userResult.user_name}:`)
      console.log(`     Activities: ${userResult.activities_fetched}`)
      console.log(`     Segments: ${userResult.segments_fetched}`)
      console.log(`     Success: ${userResult.success}`)
      if (userResult.message) {
        console.log(`     Message: ${userResult.message}`)
      }
    })
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testComprehensiveCrawler() 