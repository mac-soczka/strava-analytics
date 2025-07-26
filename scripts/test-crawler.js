const { StravaCrawlerService } = require('../lib/services/strava-crawler-service.ts')

async function testCrawler() {
  console.log('🧪 Testing Strava Crawler...')
  
  try {
    const crawlerService = new StravaCrawlerService()
    
    console.log('📊 Getting entity stats before crawler run...')
    const statsBefore = await crawlerService.getEntityStats()
    console.log('Before:', statsBefore)
    
    console.log('🔄 Running crawler with limited batch size for testing...')
    const results = await crawlerService.crawlStravaData({
      batch_size: 10, // Small batch for testing
      include_segments: true,
      segment_batch_size: 5
    })
    
    console.log('✅ Crawler completed!')
    console.log('Results:', JSON.stringify(results, null, 2))
    
    console.log('📊 Getting entity stats after crawler run...')
    const statsAfter = await crawlerService.getEntityStats()
    console.log('After:', statsAfter)
    
    // Calculate differences
    const activityDiff = statsAfter.totals.activities - statsBefore.totals.activities
    const segmentDiff = statsAfter.totals.segments - statsBefore.totals.segments
    const effortDiff = statsAfter.totals.segment_efforts - statsBefore.totals.segment_efforts
    
    console.log('📈 Changes:')
    console.log(`   Activities: +${activityDiff}`)
    console.log(`   Segments: +${segmentDiff}`)
    console.log(`   Segment Efforts: +${effortDiff}`)
    
    if (results.success) {
      console.log('🎉 Crawler test successful!')
    } else {
      console.log('❌ Crawler test failed!')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testCrawler() 