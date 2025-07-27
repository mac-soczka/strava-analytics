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
    
    console.log(`✅ Cron job completed. Processed ${results.users_processed} users`)
    
    // Log summary
    const successful = results.users_successful
    const totalActivities = results.total_activities
    const totalSegments = results.total_segments
    
    console.log(`📊 Summary: ${successful}/${results.users_processed} users successful`)
    console.log(`📊 Total activities: ${totalActivities}, segments: ${totalSegments}`)
    
    return {
      success: true,
      users_processed: results.users_processed,
      users_successful: successful,
      total_activities: totalActivities,
      total_segments: totalSegments,
      results: results.results
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