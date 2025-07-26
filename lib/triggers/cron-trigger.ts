import { StravaCrawlerService } from '../services/strava-crawler-service'
import { config } from '../config'

/**
 * Cron job trigger for Strava data crawling
 * This function can be called by Supabase cron jobs
 */
export async function cronTrigger() {
  console.log('🕐 Cron job triggered at:', new Date().toISOString())
  
  try {
    const crawlerService = new StravaCrawlerService()
    
    // Process all users with valid tokens
    const results = await crawlerService.crawlStravaData({
      batch_size: config.stravaApiLimits.maxCrawlerBatchSize,
      include_segments: true
    })
    
    console.log(`✅ Cron job completed. Processed ${results.length} users`)
    
    // Log summary
    const successful = results.filter(r => r.success).length
    const totalActivities = results.reduce((sum, r) => sum + r.activities_fetched, 0)
    const totalSegments = results.reduce((sum, r) => sum + r.segments_fetched, 0)
    
    console.log(`📊 Summary: ${successful}/${results.length} users successful`)
    console.log(`📊 Total activities: ${totalActivities}, segments: ${totalSegments}`)
    
    return {
      success: true,
      users_processed: results.length,
      users_successful: successful,
      total_activities: totalActivities,
      total_segments: totalSegments,
      results
    }
    
  } catch (error: any) {
    console.error('❌ Cron job failed:', error)
    
    return {
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

// Export for Supabase Edge Functions
export default cronTrigger 