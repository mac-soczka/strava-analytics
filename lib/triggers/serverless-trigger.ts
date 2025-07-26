import { StravaCrawlerService } from '../services/strava-crawler-service'
import { AuthServiceServer } from '../services/auth-service-server'
import { config } from '../config'

/**
 * Serverless function trigger for Strava data crawling
 * This function can be called via HTTP requests (user-triggered)
 */
export async function serverlessTrigger(req: Request) {
  console.log('🔗 Serverless function triggered at:', new Date().toISOString())
  
  try {
    // Parse request body for options
    let options: any = {}
    try {
      const body = await req.json()
      options = body || {}
    } catch (e) {
      // No body or invalid JSON, use defaults
    }
    
    // Get user from session (if triggered from your app)
    const sessionToken = req.headers.get('authorization')?.replace('Bearer ', '')
    let userId: number | undefined
    
    if (sessionToken) {
      try {
        const user = await AuthServiceServer.getCurrentUser(sessionToken)
        if (user) {
          userId = user.strava_id
          console.log(`👤 Processing for authenticated user: ${user.firstname} (${user.strava_id})`)
        }
      } catch (authError) {
        console.warn('⚠️ Authentication failed, will process all users:', authError)
      }
    }
    
    const crawlerService = new StravaCrawlerService()
    
    // Build crawler options
    const crawlerOptions = {
      batch_size: options.batch_size || config.stravaApiLimits.maxCrawlerBatchSize,
      include_segments: options.include_segments !== false, // Default to true
      skip_invalid_tokens: options.skip_invalid_tokens || false,
      segment_batch_size: options.segment_batch_size || config.stravaApiLimits.maxSegmentBatchSize
    }
    
    // Process user(s) based on authentication context
    const results = await crawlerService.crawlStravaData(crawlerOptions)
    
    console.log(`✅ Serverless function completed. Processed ${results.users_processed} user(s)`)
    
    const response = {
      success: results.success,
      user_id: userId,
      users_processed: results.users_processed,
      users_successful: results.users_successful,
      total_activities: results.total_activities,
      total_segments: results.total_segments,
      results: results.results,
      timestamp: new Date().toISOString()
    }
    
    return Response.json(response)
    
  } catch (error: any) {
    console.error('❌ Serverless function failed:', error)
    
    return Response.json({
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Export for Supabase Edge Functions
export default serverlessTrigger 